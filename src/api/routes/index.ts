import { Express } from 'express'
import { healthRoutes } from './health'
import { templateRoutes } from './template'
import { formatRoutes } from './formats'
import { docsRoutes } from './docs'

export function setupRoutes(app: Express): void {
  // API version prefix
  const apiPrefix = '/api/v1'
  
  // Health check (no version prefix)
  app.use('/health', healthRoutes)
  
  // API routes
  app.use(`${apiPrefix}/templates`, templateRoutes)
  app.use(`${apiPrefix}/formats`, formatRoutes)
  app.use(`${apiPrefix}/docs`, docsRoutes)
  
  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'Template Engine API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health',
        templates: `${apiPrefix}/templates`,
        formats: `${apiPrefix}/formats`,
        docs: `${apiPrefix}/docs`
      }
    })
  })
}