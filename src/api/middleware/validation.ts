
import { Request, Response, NextFunction } from 'express'
import { body, validationResult } from 'express-validator'
import { ApiError } from '../utils/ApiError'

export const validateTemplate = [
  body('template.content')
    .optional()
    .isString()
    .withMessage('Template content must be a string'),
  
  body('template.format')
    .optional()
    .isIn(['docx', 'xlsx', 'odt', 'html', 'txt', 'csv'])
    .withMessage('Invalid template format'),
  
  body('data')
    .exists()
    .withMessage('Template data is required'),
  
  body('options.convertTo')
    .optional()
    .isIn(['docx', 'xlsx', 'odt', 'html', 'txt', 'csv', 'pdf'])
    .withMessage('Invalid output format'),
  
  body('options.filename')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('Filename must be a string with max 255 characters'),

  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg).join(', ')
      throw new ApiError('VALIDATION_ERROR', errorMessages, 400)
    }
    next()
  }
]