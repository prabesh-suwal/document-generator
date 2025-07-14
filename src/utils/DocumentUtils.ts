import { DocumentFormat } from '../types/core'

export class DocumentUtils {
  /**
   * Detect document format from buffer content
   */
  public static detectFormat(buffer: Buffer): DocumentFormat {
    const header = buffer.slice(0, 16)
    
    // Check for ZIP-based formats (DOCX, XLSX, etc.)
    if (header.slice(0, 2).toString('hex') === '504b') {
      return this.detectOfficeFormat(buffer)
    }
    
    // Check for PDF
    if (header.slice(0, 4).toString() === '%PDF') {
      return DocumentFormat.PDF
    }
    
    // Check for HTML
    const content = buffer.toString('utf8', 0, 1024).toLowerCase()
    if (content.includes('<html') || content.includes('<!doctype html')) {
      return DocumentFormat.HTML
    }
    
    // Check for XML
    if (content.trimStart().startsWith('<?xml')) {
      return DocumentFormat.XML
    }
    
    // Default to text
    return DocumentFormat.TXT
  }

  /**
   * Detect specific Office format from ZIP content
   */
  public static detectOfficeFormat(buffer: Buffer): DocumentFormat {
    try {
      const JSZip = require('jszip')
      const zip = JSZip.loadAsync(buffer)
      
      return zip.then((zipFile: any) => {
        if (zipFile.files['word/document.xml']) {
          return DocumentFormat.DOCX
        }
        if (zipFile.files['xl/workbook.xml']) {
          return DocumentFormat.XLSX
        }
        if (zipFile.files['ppt/presentation.xml']) {
          return DocumentFormat.PPTX
        }
        if (zipFile.files['content.xml']) {
          // OpenDocument format
          const mimeType = zipFile.files['mimetype']
          if (mimeType) {
            return mimeType.async('string').then((mime: string) => {
              if (mime.includes('text')) return DocumentFormat.ODT
              if (mime.includes('spreadsheet')) return DocumentFormat.ODS
              if (mime.includes('presentation')) return DocumentFormat.ODP
              return DocumentFormat.ODT
            })
          }
        }
        return DocumentFormat.TXT
      })
    } catch {
      return DocumentFormat.TXT
    }
  }

  /**
   * Get MIME type for document format
   */
  public static getMimeType(format: DocumentFormat): string {
    const mimeTypes: Record<DocumentFormat, string> = {
      [DocumentFormat.PDF]: 'application/pdf',
      [DocumentFormat.DOCX]: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      [DocumentFormat.XLSX]: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      [DocumentFormat.PPTX]: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      [DocumentFormat.ODT]: 'application/vnd.oasis.opendocument.text',
      [DocumentFormat.ODS]: 'application/vnd.oasis.opendocument.spreadsheet',
      [DocumentFormat.ODP]: 'application/vnd.oasis.opendocument.presentation',
      [DocumentFormat.HTML]: 'text/html',
      [DocumentFormat.TXT]: 'text/plain',
      [DocumentFormat.CSV]: 'text/csv',
      [DocumentFormat.XML]: 'application/xml',
      [DocumentFormat.MARKDOWN]: 'text/markdown',
      [DocumentFormat.RTF]: 'application/rtf',    // Add this line
    }
    
    return mimeTypes[format] || 'application/octet-stream'
  }

  /**
   * Validate document content
   */
  public static validateDocument(buffer: Buffer, expectedFormat?: DocumentFormat): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Check file size
    if (buffer.length === 0) {
      errors.push('Document is empty')
    }
    
    if (buffer.length > 100 * 1024 * 1024) { // 100MB
      warnings.push('Document is very large and may cause performance issues')
    }
    
    // Detect actual format
    const detectedFormat = this.detectFormat(buffer)
    
    if (expectedFormat && detectedFormat !== expectedFormat) {
      warnings.push(`Expected format ${expectedFormat} but detected ${detectedFormat}`)
    }
    
    // Format-specific validation
    if (detectedFormat === DocumentFormat.PDF) {
      if (!this.isValidPDF(buffer)) {
        errors.push('Invalid PDF structure')
      }
    } else if (detectedFormat === DocumentFormat.HTML) {
      if (!this.isValidHTML(buffer)) {
        warnings.push('HTML content may have structural issues')
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      detectedFormat
    }
  }

  /**
   * Extract text content from document
   */
  public static extractText(buffer: Buffer, format: DocumentFormat): Promise<string> {
    switch (format) {
      case DocumentFormat.TXT:
      case DocumentFormat.HTML:
      case DocumentFormat.XML:
      case DocumentFormat.CSV:
      case DocumentFormat.MARKDOWN:
        return Promise.resolve(buffer.toString('utf8'))
        
      case DocumentFormat.PDF:
        return this.extractTextFromPDF(buffer)
        
      case DocumentFormat.DOCX:
        return this.extractTextFromDOCX(buffer)
        
      case DocumentFormat.XLSX:
        return this.extractTextFromXLSX(buffer)
        
      default:
        return Promise.resolve('')
    }
  }

  /**
   * Calculate document metrics
   */
  public static calculateMetrics(content: string): DocumentMetrics {
    const lines = content.split('\n')
    const words = content.split(/\s+/).filter(word => word.length > 0)
    const characters = content.length
    const charactersNoSpaces = content.replace(/\s/g, '').length
    
    // Estimate reading time (average 200 words per minute)
    const readingTimeMinutes = Math.ceil(words.length / 200)
    
    // Count template tags
    const templateTags = (content.match(/\{[^}]+\}/g) || []).length
    
    return {
      lines: lines.length,
      words: words.length,
      characters,
      charactersNoSpaces,
      readingTimeMinutes,
      templateTags,
      estimatedProcessingTime: this.estimateProcessingTime(templateTags, words.length)
    }
  }

  private static isValidPDF(buffer: Buffer): boolean {
    const header = buffer.slice(0, 8).toString()
    return header.startsWith('%PDF-')
  }

  private static isValidHTML(buffer: Buffer): boolean {
    const content = buffer.toString('utf8', 0, 1024).toLowerCase()
    return content.includes('<html') || content.includes('<!doctype')
  }

  private static async extractTextFromPDF(buffer: Buffer): Promise<string> {
    // This would require a PDF parsing library like pdf-parse
    try {
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(buffer)
      return data.text
    } catch {
      return 'PDF text extraction not available'
    }
  }

  private static async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch {
      return 'DOCX text extraction not available'
    }
  }

  private static async extractTextFromXLSX(buffer: Buffer): Promise<string> {
    try {
      const XLSX = require('xlsx')
      const workbook = XLSX.read(buffer)
      const texts: string[] = []
      
      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        texts.push(csv)
      })
      
      return texts.join('\n\n')
    } catch {
      return 'XLSX text extraction not available'
    }
  }

  private static estimateProcessingTime(templateTags: number, wordCount: number): number {
    // Rough estimation based on complexity
    const baseTime = 1 // 1ms base
    const tagTime = templateTags * 0.5 // 0.5ms per tag
    const contentTime = wordCount * 0.01 // 0.01ms per word
    
    return Math.ceil(baseTime + tagTime + contentTime)
  }
}

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  detectedFormat: DocumentFormat
}

interface DocumentMetrics {
  lines: number
  words: number
  characters: number
  charactersNoSpaces: number
  readingTimeMinutes: number
  templateTags: number
  estimatedProcessingTime: number
}