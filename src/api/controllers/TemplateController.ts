import { Request, Response, NextFunction } from 'express'
import { TemplateEngine } from '../../engine/TemplateEngine'
import { DocumentFormat } from '../../types/core'
import { ApiError } from '../utils/ApiError'
import { sendFile, sendError, sendSuccess } from '../utils/responseHelpers'
import { logger } from '../utils/logger'
import { performance } from 'perf_hooks'

export class TemplateController {
  private engine: TemplateEngine

  constructor() {
    this.engine = new TemplateEngine()
  }

  public async renderFromFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now()
    
    try {
      if (!req.file) {
        throw new ApiError('MISSING_TEMPLATE', 'Template file is required', 400)
      }

      const { data, options } = this.parseRequestBody(req.body)
      const format = this.getFormatFromMimeType(req.file.mimetype)
      
      if (!format) {
        throw new ApiError('UNSUPPORTED_FORMAT', 'Unsupported template format', 400)
      }

      const result = await this.engine.render({
        template: {
          content: req.file.buffer,
          format: format
        },
        data: data,
        options: {
          convertTo: options?.convertTo || format,
          locale: options?.locale,
          complement: options?.complement
        }
      })

      const processingTime = performance.now() - startTime
      const filename = options?.filename || req.file.originalname || 'document'

      await sendFile(res, result, filename, processingTime)
      
      logger.info('Template rendered successfully', {
        format,
        outputFormat: options?.convertTo || format,
        processingTime: Math.round(processingTime),
        fileSize: result.content.length
      })

    } catch (error) {
      logger.error('Template rendering error:', error)
      next(error)
    }
  }

  public async renderFromJson(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = performance.now()
    
    try {
      const { template, data, options } = req.body

      if (!template?.content) {
        throw new ApiError('MISSING_TEMPLATE', 'Template content is required', 400)
      }

      if (!data) {
        throw new ApiError('MISSING_DATA', 'Template data is required', 400)
      }

      // Handle base64 encoded content
      const templateContent = this.processTemplateContent(template.content)

      const result = await this.engine.render({
        template: {
          content: templateContent,
          format: template.format || DocumentFormat.TXT
        },
        data: data,
        options: {
          convertTo: options?.convertTo || template.format || DocumentFormat.DOCX,
          locale: options?.locale,
          complement: options?.complement
        }
      })

      const processingTime = performance.now() - startTime
      const filename = options?.filename || 'document'

      await sendFile(res, result, filename, processingTime)
      
      logger.info('JSON template rendered successfully', {
        inputFormat: template.format,
        outputFormat: options?.convertTo,
        processingTime: Math.round(processingTime),
        fileSize: result.content.length
      })

    } catch (error) {
      logger.error('JSON template rendering error:', error)
      next(error)
    }
  }

  public async renderBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { templates } = req.body

      if (!Array.isArray(templates) || templates.length === 0) {
        throw new ApiError('INVALID_BATCH', 'Templates array is required', 400)
      }

      const results = await Promise.allSettled(
        templates.map(async (templateRequest: any, index: number) => {
          const startTime = performance.now()
          
          try {
            const result = await this.engine.render(templateRequest)
            const processingTime = performance.now() - startTime
            
            return {
              index,
              success: true,
              result: {
                content: result.content.toString('base64'),
                format: result.format,
                metadata: result.metadata,
                processingTime: Math.round(processingTime)
              }
            }
          } catch (error) {
            return {
              index,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        })
      )

      const response = {
        success: true,
        data: {
          totalTemplates: templates.length,
          results: results.map(result => 
            result.status === 'fulfilled' ? result.value : {
              success: false,
              error: result.reason
            }
          )
        }
      }

      res.json(response)

    } catch (error) {
      next(error)
    }
  }

  public async validateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { template } = req.body

      if (!template?.content) {
        throw new ApiError('MISSING_TEMPLATE', 'Template content is required', 400)
      }

      const parsedTemplate = await this.engine.parseTemplate({
        content: this.processTemplateContent(template.content),
        format: template.format || DocumentFormat.TXT
      })

      const validation = this.engine.validateTemplate(parsedTemplate)

      sendSuccess(res, {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        templateInfo: {
          tagCount: parsedTemplate.tags.length,
          format: parsedTemplate.format,
          hasArrayOperations: parsedTemplate.tags.some(tag => tag.arrayPath),
          hasFormatters: parsedTemplate.tags.some(tag => tag.formatters.length > 0)
        }
      })

    } catch (error) {
      next(error)
    }
  }

  public async previewTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { template, data } = req.body

      // Create sample data if not provided
      const sampleData = data || this.generateSampleData(template.content)

      const result = await this.engine.render({
        template: {
          content: this.processTemplateContent(template.content),
          format: template.format || DocumentFormat.TXT
        },
        data: sampleData,
        options: {
          convertTo: DocumentFormat.TXT // Always return as text for preview
        }
      })

      sendSuccess(res, {
        preview: result.content.toString('utf-8'),
        sampleData: sampleData,
        warnings: result.warnings
      })

    } catch (error) {
      next(error)
    }
  }

  private parseRequestBody(body: any): { data: any, options?: any } {
    try {
      return {
        data: typeof body.data === 'string' ? JSON.parse(body.data) : body.data,
        options: typeof body.options === 'string' ? JSON.parse(body.options) : body.options
      }
    } catch (error) {
      throw new ApiError('INVALID_JSON', 'Invalid JSON in request body', 400)
    }
  }

  private processTemplateContent(content: string | Buffer): Buffer {
    if (Buffer.isBuffer(content)) {
      return content
    }

    if (typeof content === 'string') {
      if (content.startsWith('data:')) {
        // Data URL format
        const base64Data = content.split(',')[1]
        return Buffer.from(base64Data, 'base64')
      } else {
        // Try base64 decode, fallback to UTF-8
        try {
          return Buffer.from(content, 'base64')
        } catch {
          return Buffer.from(content, 'utf-8')
        }
      }
    }

    throw new ApiError('INVALID_CONTENT', 'Invalid template content format', 400)
  }

  private getFormatFromMimeType(mimeType: string): DocumentFormat | null {
    const mimeMap: Record<string, DocumentFormat> = {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DocumentFormat.DOCX,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': DocumentFormat.XLSX,
      'application/vnd.oasis.opendocument.text': DocumentFormat.ODT,
      'text/html': DocumentFormat.HTML,
      'text/plain': DocumentFormat.TXT,
      'text/csv': DocumentFormat.CSV
    }
    return mimeMap[mimeType] || null
  }

  private generateSampleData(templateContent: string): any {
    // Extract template tags and generate sample data
    const tags = templateContent.match(/\{d\.[^}]+\}/g) || []
    const sampleData: any = {}

    tags.forEach(tag => {
      const path = tag.replace(/\{d\./, '').replace(/\}/, '').split(':')[0]
      const parts = path.split('.')
      
      let current = sampleData
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {}
        }
        current = current[parts[i]]
      }
      
      const lastPart = parts[parts.length - 1]
      if (lastPart.includes('[')) {
        const arrayName = lastPart.split('[')[0]
        current[arrayName] = [
          { name: 'Sample Item 1', value: 100 },
          { name: 'Sample Item 2', value: 200 }
        ]
      } else {
        current[lastPart] = 'Sample Value'
      }
    })

    return sampleData
  }
}