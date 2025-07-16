
import { Request, Response, NextFunction } from 'express'
import { ApiError } from '../utils/ApiError'
import { logger } from '../utils/logger'

export function errorHandler(
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(error)
  }

  let statusCode = 500
  let code = 'INTERNAL_ERROR'
  let message = 'Internal server error'

  if (error instanceof ApiError) {
    statusCode = error.statusCode
    code = error.code
    message = error.message
  } else if (error.name === 'ValidationError') {
    statusCode = 400
    code = 'VALIDATION_ERROR'
    message = error.message
  } else if (error.name === 'MulterError') {
    statusCode = 400
    code = 'UPLOAD_ERROR'
    message = error.message
  }

  // Log error
  logger.error('API Error:', {
    code,
    message,
    statusCode,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  })

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  })
}