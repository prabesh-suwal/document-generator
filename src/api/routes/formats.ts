import { Router } from 'express'
import { FormatController } from '../controllers/FormatController'

const router = Router()
const formatController = new FormatController()

// Get supported formats
router.get('/', formatController.getSupportedFormats.bind(formatController))

// Get format details
router.get('/:format', formatController.getFormatDetails.bind(formatController))

// Check format compatibility
router.post('/compatibility', formatController.checkCompatibility.bind(formatController))

export { router as formatRoutes }
