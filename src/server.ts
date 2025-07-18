import express from 'express'
import multer from 'multer'
import cors from 'cors'
import { DocumentFormat } from './types/core'
import { EnhancedTemplateEngine } from './handlers/DocumentFormatHandlers'
import { DocumentUtils } from './utils/DocumentUtils'

const app = express()
const port = process.env.PORT || 3000

// Initialize the template engine
const templateEngine = new EnhancedTemplateEngine()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept DOCX files

    cb(null, true)
    // if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    //   cb(null, true)
    // } else {
    //   cb(new Error('Only DOCX files are allowed'))
    // }
  }
})

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
// app.get('/health', async (req, res) => {
//   try {
//     const health = await templateEngine.healthCheck()
//     res.status(health.status === 'healthy' ? 200 : 503).json(health)
//   } catch (error) {
//     res.status(500).json({
//       status: 'unhealthy',
//       error: error instanceof Error ? error.message : 'Unknown error'
//     })
//   }
// })

// Main DOCX processing endpoint
app.post('/api/render-docx', upload.single('template'), async (req, res) => {
  try {
    const { data, options } = req.body
    const templateFile = req.file

    if (!templateFile) {
      return res.status(400).json({
        success: false,
        error: 'No template file provided'
      })
    }

    // Parse JSON data
    let parsedData: any
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON data provided'
      })
    }

    // Parse options
    let parsedOptions: any = {}
    if (options) {
      try {
        parsedOptions = typeof options === 'string' ? JSON.parse(options) : options
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid options JSON provided'
        })
      }
    }

    // Set default convert format to DOCX if not specified
    const convertTo = parsedOptions.convertTo || DocumentFormat.DOCX

    // Render the document
    const result = await templateEngine.renderWithFormat({
      template: {
        content: templateFile.buffer,
        format: DocumentFormat.DOCX
      },
      data: parsedData,
      options: {
        ...parsedOptions,
        convertTo: convertTo
      }
    })

    // Set appropriate headers
    const mimeType = DocumentUtils.getMimeType(result.format)
    const fileExtension = result.format.toLowerCase()
    const filename = `rendered-document.${fileExtension}`

    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', result.content.length)

    // Send the file
    res.send(result.content)

  } catch (error) {
    console.error('Error rendering DOCX:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

// Alternative JSON-based endpoint (for base64 templates)
app.post('/api/render-docx-json', async (req, res) => {
  try {
    const { template, data, options } = req.body

    if (!template || !template.content) {
      return res.status(400).json({
        success: false,
        error: 'Template content is required'
      })
    }

    // Handle base64 encoded template
    let templateBuffer: Buffer
    if (typeof template.content === 'string') {
      try {
        templateBuffer = Buffer.from(template.content, 'base64')
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid base64 template content'
        })
      }
    } else {
      templateBuffer = Buffer.from(template.content)
    }

    // Set default convert format
    const convertTo = options?.convertTo || DocumentFormat.DOCX

    // Render the document
    const result = await templateEngine.renderWithFormat({
      template: {
        content: templateBuffer,
        format: template.format || DocumentFormat.DOCX
      },
      data: data || {},
      options: {
        ...options,
        convertTo: convertTo
      }
    })

    // Return as base64 for JSON response
    res.json({
      success: true,
      data: {
        content: result.content.toString('base64'),
        format: result.format,
        metadata: result.metadata,
        warnings: result.warnings
      }
    })

  } catch (error) {
    console.error('Error rendering DOCX (JSON):', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

// Template validation endpoint
app.post('/api/validate-template', upload.single('template'), async (req, res) => {
  try {
    const templateFile = req.file

    if (!templateFile) {
      return res.status(400).json({
        success: false,
        error: 'No template file provided'
      })
    }

    // Parse the template
    const parsedTemplate = await templateEngine.parseTemplate({
      content: templateFile.buffer,
      format: DocumentFormat.DOCX
    })

    // Validate the template
    const validation = templateEngine.validateTemplate(parsedTemplate)

    res.json({
      success: true,
      validation: validation,
      templateInfo: {
        id: parsedTemplate.id,
        format: parsedTemplate.format,
        tagCount: parsedTemplate.tags.length,
        tags: parsedTemplate.tags.map(tag => ({
          id: tag.id,
          type: tag.type,
          path: tag.path,
          formatters: tag.formatters,
          raw: tag.raw
        }))
      }
    })

  } catch (error) {
    console.error('Error validating template:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    })
  }
})

// Get supported formats
app.get('/api/formats', (req, res) => {
  res.json({
    success: true,
    formats: Object.values(DocumentFormat),
    supportedInputFormats: [DocumentFormat.DOCX, DocumentFormat.HTML, DocumentFormat.TXT],
    supportedOutputFormats: [DocumentFormat.DOCX, DocumentFormat.PDF, DocumentFormat.HTML]
  })
})

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error)
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  })
})

// Start server
app.listen(port, () => {
  console.log(`🚀 Template Engine Server running on port ${port}`)
  console.log(`📚 API Documentation:`)
  console.log(`   POST /api/render-docx - Render DOCX with file upload`)
  console.log(`   POST /api/render-docx-json - Render DOCX with JSON payload`)
  console.log(`   POST /api/validate-template - Validate template`)
  console.log(`   GET /api/formats - Get supported formats`)
  console.log(`   GET /health - Health check`)
})

export default app