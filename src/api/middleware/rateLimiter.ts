
import rateLimit from 'express-rate-limit'
import { config } from '../../config/app'

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator (optional)
  keyGenerator: (req) => {
    return req.ip || 'anonymous'
  }
})
