import { Router } from 'express'
import { TemplateController } from '../controllers/TemplateController'
import { uploadMiddleware } from '../middleware/upload'
import { validateTemplate } from '../middleware/validation'
import { rateLimiter } from '../middleware/rateLimiter'

const router = Router()
const templateController = new TemplateController()

// Apply rate limiting to all template routes
router.use(rateLimiter)

// Template rendering with file upload
router.post('/render',
  uploadMiddleware.single('template'),
  validateTemplate,
  templateController.renderFromFile.bind(templateController)
)

// Template rendering with JSON body
router.post('/render-json',
  validateTemplate,
  templateController.renderFromJson.bind(templateController)
)

// Batch template processing
router.post('/render-batch',
  validateTemplate,
  templateController.renderBatch.bind(templateController)
)

// Template validation only
router.post('/validate',
  validateTemplate,
  templateController.validateTemplate.bind(templateController)
)

// Template preview (limited processing)
router.post('/preview',
  validateTemplate,
  templateController.previewTemplate.bind(templateController)
)

export { router as templateRoutes }