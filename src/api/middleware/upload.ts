
import multer from 'multer'
import { config } from '../../config/app'
import { ApiError } from '../utils/ApiError'

const storage = multer.memoryStorage()

export const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFiles
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'application/vnd.oasis.opendocument.text', // ODT
      'text/html',
      'text/plain',
      'text/csv',
      'application/xml'
    ]
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new ApiError('UNSUPPORTED_FILE_TYPE', `Unsupported file type: ${file.mimetype}`, 400))
    }
  }
})