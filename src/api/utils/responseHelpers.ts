
import { Response } from 'express'
import { RenderedDocument } from '../../types/core'

export function sendSuccess(res: Response, data: any, message?: string): void {
  res.json({
    success: true,
    message: message || 'Operation completed successfully',
    data: data
  })
}

export function sendError(res: Response, code: string, message: string, details?: any, status: number = 500): void {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: details instanceof Error ? details.message : details
    }
  })
}

export async function sendFile(
  res: Response, 
  document: RenderedDocument, 
  filename: string, 
  processingTime: number
): Promise<void> {
  const contentType = getContentType(document.format)
  const extension = getFileExtension(document.format)
  const finalFilename = filename.includes('.') ? filename : `${filename}${extension}`

  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`)
  res.setHeader('Content-Length', document.content.length)
  res.setHeader('X-Processing-Time', Math.round(processingTime))
  res.setHeader('X-Template-Format', document.format)
  
  if (document.warnings && document.warnings.length > 0) {
    res.setHeader('X-Warnings', JSON.stringify(document.warnings))
  }

  res.send(document.content)
}

function getContentType(format: string): string {
  const contentTypes: Record<string, string> = {
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'odt': 'application/vnd.oasis.opendocument.text',
    'html': 'text/html',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'pdf': 'application/pdf'
  }
  return contentTypes[format] || 'application/octet-stream'
}

function getFileExtension(format: string): string {
  const extensions: Record<string, string> = {
    'docx': '.docx',
    'xlsx': '.xlsx',
    'odt': '.odt',
    'html': '.html',
    'txt': '.txt',
    'csv': '.csv',
    'pdf': '.pdf'
  }
  return extensions[format] || '.bin'
}
