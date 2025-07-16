import { Router } from 'express'
import { HealthController } from '../controllers/HealthController'

const router = Router()
const healthController = new HealthController()

// Basic health check
router.get('/', healthController.basicHealth.bind(healthController))

// Detailed health check
router.get('/detailed', healthController.detailedHealth.bind(healthController))

// Readiness check (for Kubernetes)
router.get('/ready', healthController.readinessCheck.bind(healthController))

// Liveness check (for Kubernetes)
router.get('/live', healthController.livenessCheck.bind(healthController))

export { router as healthRoutes }