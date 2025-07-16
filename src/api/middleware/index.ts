
import { Express } from 'express'
import { rateLimiter } from './rateLimiter'
import { logger } from '../utils/logger'
import morgan from 'morgan'

export function setupMiddleware(app: Express): void {
  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim())
      }
    }
  }))

  // Global rate limiting (less strict than template-specific)
  app.use('/api', rateLimiter)

  // Request ID middleware
  app.use((req, res, next) => {
    req.id = Math.random().toString(36).substr(2, 9)
    res.setHeader('X-Request-ID', req.id)
    next()
  })

  // Request timing
  app.use((req, res, next) => {
    req.startTime = Date.now()
    res.on('finish', () => {
      const duration = Date.now() - req.startTime
      logger.debug('Request completed', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId: req.id
      })
    })
    next()
  })
}
