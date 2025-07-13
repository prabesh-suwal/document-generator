// ============================================================================
// PDF CONVERSION SERVICE - COMPLETE IMPLEMENTATION
// ============================================================================

// Note: This requires puppeteer to be installed
// npm install puppeteer

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'
import { DocumentFormat, EngineConfig, RenderedDocument, RenderRequest } from '../types/core'
import { EnhancedTemplateEngine } from '../handlers/DocumentFormatHandlers'

// Conditional import for puppeteer
let puppeteer: any = null
try {
  puppeteer = require('puppeteer')
} catch (error) {
  console.warn('Puppeteer not installed. HTML to PDF conversion will not be available.')
}

// ============================================================================
// 1. CONVERSION INTERFACES
// ============================================================================

export interface ConversionOptions {
  quality?: 'low' | 'medium' | 'high'
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal'
  orientation?: 'portrait' | 'landscape'
  margins?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
  timeout?: number
  headerTemplate?: string
  footerTemplate?: string
  displayHeaderFooter?: boolean
}

export interface ConversionResult {
  success: boolean
  output: Buffer
  format: DocumentFormat
  metadata: ConversionMetadata
  errors?: string[]
}

export interface ConversionMetadata {
  originalFormat: DocumentFormat
  targetFormat: DocumentFormat
  fileSize: number
  duration: number
  converter: string
  timestamp: Date
}

export interface ConverterEngine {
  name: string
  supportedInputs: DocumentFormat[]
  supportedOutputs: DocumentFormat[]
  canConvert(from: DocumentFormat, to: DocumentFormat): boolean
  convert(input: Buffer, from: DocumentFormat, to: DocumentFormat, options?: ConversionOptions): Promise<ConversionResult>
}

// ============================================================================
// 2. BROWSER POOL MANAGER
// ============================================================================

export class BrowserPool {
  private browsers: any[] = []
  private availableBrowsers: any[] = []
  private readonly maxBrowsers: number
  private readonly minBrowsers: number
  private isInitialized = false

  constructor(options: { min?: number; max?: number } = {}) {
    this.minBrowsers = options.min || 1
    this.maxBrowsers = options.max || 3
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized || !puppeteer) return

    // Launch minimum number of browsers
    for (let i = 0; i < this.minBrowsers; i++) {
      await this.createBrowser()
    }

    this.isInitialized = true
  }

  public async acquire(): Promise<any> {
    if (!puppeteer) {
      throw new Error('Puppeteer not available. Install with: npm install puppeteer')
    }

    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.availableBrowsers.length > 0) {
      return this.availableBrowsers.pop()!
    }

    // Create new browser if under limit
    if (this.browsers.length < this.maxBrowsers) {
      return await this.createBrowser()
    }

    // Wait for a browser to become available
    return new Promise((resolve) => {
      const checkAvailable = () => {
        if (this.availableBrowsers.length > 0) {
          resolve(this.availableBrowsers.pop()!)
        } else {
          setTimeout(checkAvailable, 100)
        }
      }
      checkAvailable()
    })
  }

  public release(browser: any): void {
    if (this.browsers.includes(browser)) {
      this.availableBrowsers.push(browser)
    }
  }

  public async shutdown(): Promise<void> {
    const closePromises = this.browsers.map(browser => browser.close())
    await Promise.all(closePromises)
    this.browsers = []
    this.availableBrowsers = []
    this.isInitialized = false
  }

  private async createBrowser(): Promise<any> {
    if (!puppeteer) {
      throw new Error('Puppeteer not available')
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    })

    this.browsers.push(browser)
    this.availableBrowsers.push(browser)
    return browser
  }

  public getStats() {
    return {
      total: this.browsers.length,
      available: this.availableBrowsers.length,
      busy: this.browsers.length - this.availableBrowsers.length
    }
  }
}

// ============================================================================
// 3. CHROMIUM/PUPPETEER CONVERTER
// ============================================================================

export class ChromiumConverter implements ConverterEngine {
  public name = 'Chromium'
  public supportedInputs = [DocumentFormat.HTML]
  public supportedOutputs = [DocumentFormat.PDF]
  
  private browserPool: BrowserPool

  constructor(poolOptions?: { min?: number; max?: number }) {
    this.browserPool = new BrowserPool(poolOptions)
  }

  public canConvert(from: DocumentFormat, to: DocumentFormat): boolean {
    return puppeteer && this.supportedInputs.includes(from) && this.supportedOutputs.includes(to)
  }

  public async convert(
    input: Buffer, 
    from: DocumentFormat, 
    to: DocumentFormat, 
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()

    if (!puppeteer) {
      return {
        success: false,
        output: Buffer.alloc(0),
        format: to,
        metadata: this.createMetadata(from, to, startTime),
        errors: ['Puppeteer not available. Install with: npm install puppeteer']
      }
    }

    if (!this.canConvert(from, to)) {
      return {
        success: false,
        output: Buffer.alloc(0),
        format: to,
        metadata: this.createMetadata(from, to, startTime),
        errors: [`Cannot convert from ${from} to ${to}`]
      }
    }

    try {
      const browser = await this.browserPool.acquire()
      
      try {
        const page = await browser.newPage()
        
        // Set HTML content
        const htmlContent = input.toString('utf-8')
        await page.setContent(htmlContent, { 
          waitUntil: 'networkidle0',
          timeout: options.timeout || 30000
        })

        // Configure PDF options
        const pdfOptions: any = {
          format: (options.pageSize || 'A4'),
          landscape: options.orientation === 'landscape',
          printBackground: true,
          margin: {
            top: options.margins?.top || '1cm',
            right: options.margins?.right || '1cm',
            bottom: options.margins?.bottom || '1cm',
            left: options.margins?.left || '1cm'
          }
        }

        // Add header/footer if specified
        if (options.displayHeaderFooter) {
          pdfOptions.displayHeaderFooter = true
          pdfOptions.headerTemplate = options.headerTemplate || '<div></div>'
          pdfOptions.footerTemplate = options.footerTemplate || 
            '<div style="font-size: 10px; margin: 0 auto;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>'
        }

        // Generate PDF
        const pdfBuffer = await page.pdf(pdfOptions)
        await page.close()

        return {
          success: true,
          output: Buffer.from(pdfBuffer),
          format: DocumentFormat.PDF,
          metadata: this.createMetadata(from, to, startTime, pdfBuffer.length)
        }
      } finally {
        this.browserPool.release(browser)
      }
    } catch (error) {
      return {
        success: false,
        output: Buffer.alloc(0),
        format: to,
        metadata: this.createMetadata(from, to, startTime),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  public async shutdown(): Promise<void> {
    await this.browserPool.shutdown()
  }

  private createMetadata(
    from: DocumentFormat, 
    to: DocumentFormat, 
    startTime: number, 
    fileSize: number = 0
  ): ConversionMetadata {
    return {
      originalFormat: from,
      targetFormat: to,
      fileSize,
      duration: Date.now() - startTime,
      converter: this.name,
      timestamp: new Date()
    }
  }
}

// ============================================================================
// 4. LIBREOFFICE CONVERTER
// ============================================================================

export class LibreOfficeConverter implements ConverterEngine {
  public name = 'LibreOffice'
  public supportedInputs = [
    DocumentFormat.DOCX,
    DocumentFormat.ODT,
    DocumentFormat.XLSX,
    DocumentFormat.ODS,
    DocumentFormat.PPTX,
    DocumentFormat.ODP,
    DocumentFormat.TXT
  ]
  public supportedOutputs = [
    DocumentFormat.PDF,
    DocumentFormat.DOCX,
    DocumentFormat.ODT,
    DocumentFormat.XLSX,
    DocumentFormat.ODS,
    DocumentFormat.HTML
  ]

  private readonly tempDir: string

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'template-engine-conversions')
    this.ensureTempDir()
  }

  public canConvert(from: DocumentFormat, to: DocumentFormat): boolean {
    return this.supportedInputs.includes(from) && this.supportedOutputs.includes(to)
  }

  public async convert(
    input: Buffer,
    from: DocumentFormat,
    to: DocumentFormat,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()

    if (!this.canConvert(from, to)) {
      return {
        success: false,
        output: Buffer.alloc(0),
        format: to,
        metadata: this.createMetadata(from, to, startTime),
        errors: [`Cannot convert from ${from} to ${to}`]
      }
    }

    const tempId = uuidv4()
    const inputFile = path.join(this.tempDir, `input_${tempId}.${from}`)
    const outputDir = path.join(this.tempDir, `output_${tempId}`)

    try {
      // Create output directory
      await fs.mkdir(outputDir, { recursive: true })

      // Write input file
      await fs.writeFile(inputFile, input)

      // Build LibreOffice command
      const libreOfficeCmd = this.buildLibreOfficeCommand(inputFile, outputDir, to, options)

      // Execute conversion
      const result = await this.executeCommand(libreOfficeCmd, options.timeout || 30000)

      if (!result.success) {
        return {
          success: false,
          output: Buffer.alloc(0),
          format: to,
          metadata: this.createMetadata(from, to, startTime),
          errors: result.errors
        }
      }

      // Find output file
      const outputFiles = await fs.readdir(outputDir)
      const outputFile = outputFiles.find(file => file.endsWith(`.${to}`))

      if (!outputFile) {
        return {
          success: false,
          output: Buffer.alloc(0),
          format: to,
          metadata: this.createMetadata(from, to, startTime),
          errors: ['Output file not found']
        }
      }

      // Read output file
      const outputPath = path.join(outputDir, outputFile)
      const outputBuffer = await fs.readFile(outputPath)

      return {
        success: true,
        output: outputBuffer,
        format: to,
        metadata: this.createMetadata(from, to, startTime, outputBuffer.length)
      }
    } catch (error) {
      return {
        success: false,
        output: Buffer.alloc(0),
        format: to,
        metadata: this.createMetadata(from, to, startTime),
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    } finally {
      // Cleanup temp files
      await this.cleanup([inputFile, outputDir])
    }
  }

  private buildLibreOfficeCommand(
    inputFile: string,
    outputDir: string,
    targetFormat: DocumentFormat,
    options: ConversionOptions
  ): string[] {
    const cmd = [
      'libreoffice',
      '--headless',
      '--convert-to',
      this.getLibreOfficeFormat(targetFormat),
      '--outdir',
      outputDir,
      inputFile
    ]

    // Add format-specific options
    if (targetFormat === DocumentFormat.PDF) {
      if (options.quality === 'high') {
        cmd.splice(3, 0, '--convert-to', 'pdf:writer_pdf_Export:{"Quality":100}')
      }
    }

    return cmd
  }

  private getLibreOfficeFormat(format: DocumentFormat): string {
    switch (format) {
      case DocumentFormat.PDF: return 'pdf'
      case DocumentFormat.DOCX: return 'docx'
      case DocumentFormat.ODT: return 'odt'
      case DocumentFormat.XLSX: return 'xlsx'
      case DocumentFormat.ODS: return 'ods'
      case DocumentFormat.HTML: return 'html'
      default: return format
    }
  }

  private async executeCommand(cmd: string[], timeout: number): Promise<{ success: boolean; errors?: string[] }> {
    return new Promise((resolve) => {
      const process = spawn(cmd[0], cmd.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      let timeoutId: NodeJS.Timeout

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId)
        if (!process.killed) process.kill()
      }

      timeoutId = setTimeout(() => {
        cleanup()
        resolve({
          success: false,
          errors: ['Conversion timeout']
        })
      }, timeout)

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        cleanup()
        
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({
            success: false,
            errors: [stderr || `Process exited with code ${code}`]
          })
        }
      })

      process.on('error', (error) => {
        cleanup()
        resolve({
          success: false,
          errors: [error.message]
        })
      })
    })
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true })
    } catch (error) {
      console.warn('Failed to create temp directory:', error)
    }
  }

  private async cleanup(paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        const stat = await fs.stat(filePath)
        if (stat.isDirectory()) {
          await fs.rmdir(filePath, { recursive: true })
        } else {
          await fs.unlink(filePath)
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  private createMetadata(
    from: DocumentFormat,
    to: DocumentFormat,
    startTime: number,
    fileSize: number = 0
  ): ConversionMetadata {
    return {
      originalFormat: from,
      targetFormat: to,
      fileSize,
      duration: Date.now() - startTime,
      converter: this.name,
      timestamp: new Date()
    }
  }
}

// ============================================================================
// 5. UNIFIED CONVERSION SERVICE
// ============================================================================

export class ConversionService {
  private converters: ConverterEngine[] = []
  private conversionCache: Map<string, ConversionResult> = new Map()
  private readonly cacheEnabled: boolean
  private readonly cacheMaxSize: number

  constructor(options: { 
    cacheEnabled?: boolean; 
    cacheMaxSize?: number 
  } = {}) {
    this.cacheEnabled = options.cacheEnabled || true
    this.cacheMaxSize = options.cacheMaxSize || 100
    
    this.registerDefaultConverters()
  }

  public async convert(
    input: Buffer,
    from: DocumentFormat,
    to: DocumentFormat,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    // Check cache first
    if (this.cacheEnabled) {
      const cacheKey = this.createCacheKey(input, from, to, options)
      const cached = this.conversionCache.get(cacheKey)
      if (cached) {
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            timestamp: new Date()
          }
        }
      }
    }

    // Find appropriate converter
    const converter = this.findConverter(from, to)
    if (!converter) {
      return {
        success: false,
        output: Buffer.alloc(0),
        format: to,
        metadata: {
          originalFormat: from,
          targetFormat: to,
          fileSize: 0,
          duration: 0,
          converter: 'None',
          timestamp: new Date()
        },
        errors: [`No converter available for ${from} to ${to}`]
      }
    }

    // Perform conversion
    const result = await converter.convert(input, from, to, options)

    // Cache successful results
    if (this.cacheEnabled && result.success) {
      const cacheKey = this.createCacheKey(input, from, to, options)
      this.addToCache(cacheKey, result)
    }

    return result
  }

  public findConverter(from: DocumentFormat, to: DocumentFormat): ConverterEngine | undefined {
    return this.converters.find(converter => converter.canConvert(from, to))
  }

  public getSupportedConversions(): Array<{ from: DocumentFormat; to: DocumentFormat; converter: string }> {
    const conversions: Array<{ from: DocumentFormat; to: DocumentFormat; converter: string }> = []
    
    for (const converter of this.converters) {
      for (const inputFormat of converter.supportedInputs) {
        for (const outputFormat of converter.supportedOutputs) {
          if (converter.canConvert(inputFormat, outputFormat)) {
            conversions.push({
              from: inputFormat,
              to: outputFormat,
              converter: converter.name
            })
          }
        }
      }
    }
    
    return conversions
  }

  public registerConverter(converter: ConverterEngine): void {
    this.converters.push(converter)
  }

  public async shutdown(): Promise<void> {
    // Shutdown all converters that support it
    for (const converter of this.converters) {
      if ('shutdown' in converter && typeof converter.shutdown === 'function') {
        await converter.shutdown()
      }
    }
    
    this.conversionCache.clear()
  }

  private registerDefaultConverters(): void {
    this.registerConverter(new ChromiumConverter())
    this.registerConverter(new LibreOfficeConverter())
  }

  private createCacheKey(
    input: Buffer,
    from: DocumentFormat,
    to: DocumentFormat,
    options: ConversionOptions
  ): string {
    const crypto = require('crypto')
    const hash = crypto.createHash('md5')
    hash.update(input)
    hash.update(from)
    hash.update(to)
    hash.update(JSON.stringify(options))
    return hash.digest('hex')
  }

  private addToCache(key: string, result: ConversionResult): void {
    // Implement LRU cache behavior
    if (this.conversionCache.size >= this.cacheMaxSize) {
      const firstKey = this.conversionCache.keys().next().value
      if (firstKey) {
        this.conversionCache.delete(firstKey)
      }
    }
    
    this.conversionCache.set(key, result)
  }

  public getCacheStats() {
    return {
      size: this.conversionCache.size,
      maxSize: this.cacheMaxSize,
      enabled: this.cacheEnabled
    }
  }
}

// ============================================================================
// 6. INTEGRATION WITH TEMPLATE ENGINE
// ============================================================================

export class TemplateEngineWithConversion extends EnhancedTemplateEngine {
  private conversionService: ConversionService

  constructor(config?: Partial<EngineConfig>) {
    super(config)
    this.conversionService = new ConversionService({
      cacheEnabled: true,
      cacheMaxSize: 100
    })
  }

  public async renderWithConversion(request: RenderRequest): Promise<RenderedDocument> {
    const inputFormat = request.template.format || DocumentFormat.TXT
    const outputFormat = request.options?.convertTo || inputFormat

    // First, render with format handlers
    const rendered = await super.renderWithFormat(request)

    // If output format is different from rendered format, convert
    if (outputFormat !== rendered.format) {
      const conversionResult = await this.conversionService.convert(
        rendered.content,
        rendered.format,
        outputFormat,
        {
          quality: 'high',
          pageSize: 'A4',
          orientation: 'portrait',
          timeout: 30000
        }
      )

      if (conversionResult.success) {
        return {
          ...rendered,
          content: conversionResult.output,
          format: outputFormat,
          metadata: {
            ...rendered.metadata,
            conversionApplied: true
          }
        }
      } else {
        throw new Error(`Conversion failed: ${conversionResult.errors?.join(', ')}`)
      }
    }

    return rendered
  }

  public getSupportedConversions() {
    return this.conversionService.getSupportedConversions()
  }

  public async shutdown(): Promise<void> {
    await this.conversionService.shutdown()
  }
}

// ============================================================================
// 7. USAGE EXAMPLES
// ============================================================================

/*
// Example 1: HTML to PDF conversion
const engine = new TemplateEngineWithConversion()

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { color: #333; border-bottom: 2px solid #ccc; }
        .content { margin-top: 20px; line-height: 1.6; }
        .total { font-weight: bold; font-size: 18px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Invoice #{d.invoiceNumber}</h1>
        <p>Date: {d.date}</p>
    </div>
    
    <div class="content">
        <h2>Bill To:</h2>
        <p>{d.customer.name}<br>
           {d.customer.address}<br>
           {d.customer.email}</p>
        
        <h2>Items:</h2>
        <table border="1" style="width: 100%; border-collapse: collapse;">
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Total</th>
            </tr>
            <tr>
                <td>{d.items[i].description}</td>
                <td>{d.items[i].quantity}</td>
                <td>${d.items[i].price:round(2)}</td>
                <td>${d.items[i].quantity:mul(.price):round(2)}</td>
            </tr>
        </table>
        
        <p class="total">
            Total: ${d.items[].quantity:mul(.price):aggSum():round(2)}
        </p>
    </div>
</body>
</html>
`

const invoiceData = {
  invoiceNumber: 'INV-2024-001',
  date: '2024-01-15',
  customer: {
    name: 'John Doe',
    address: '123 Main St, City, State 12345',
    email: 'john@example.com'
  },
  items: [
    { description: 'Laptop Computer', quantity: 1, price: 999.99 },
    { description: 'Wireless Mouse', quantity: 2, price: 25.99 },
    { description: 'USB Cable', quantity: 3, price: 12.99 }
  ]
}

const pdfResult = await engine.renderWithConversion({
  template: {
    content: htmlTemplate,
    format: DocumentFormat.HTML
  },
  data: invoiceData,
  options: {
    convertTo: DocumentFormat.PDF
  }
})

// Save PDF
fs.writeFileSync('invoice.pdf', pdfResult.content)

// Example 2: DOCX to PDF with LibreOffice
const docxTemplate = fs.readFileSync('contract-template.docx')

const contractResult = await engine.renderWithConversion({
  template: {
    content: docxTemplate,
    format: DocumentFormat.DOCX
  },
  data: {
    contractDate: '2024-01-15',
    clientName: 'Acme Corporation',
    projectDescription: 'Website Development Project',
    totalAmount: 15000,
    terms: '30 days net'
  },
  options: {
    convertTo: DocumentFormat.PDF
  }
})

// Example 3: Check supported conversions
const supportedConversions = engine.getSupportedConversions()
console.log('Supported conversions:', supportedConversions)

// Example 4: Shutdown (cleanup resources)
await engine.shutdown()
*/