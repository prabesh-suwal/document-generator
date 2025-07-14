import { DocumentFormat } from '../types/core'
import { CacheManager } from '../cache/CacheManager'

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
  watermark?: {
    text: string
    opacity: number
    position: 'center' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
  }
  metadata?: {
    title?: string
    author?: string
    subject?: string
    keywords?: string[]
  }
}

export interface ConversionResult {
  success: boolean
  output: Buffer
  format: DocumentFormat
  metadata: ConversionMetadata
  errors?: string[]
  warnings?: string[]
}

export interface ConversionMetadata {
  originalFormat: DocumentFormat
  targetFormat: DocumentFormat
  fileSize: number
  duration: number
  converter: string
  timestamp: Date
  options?: ConversionOptions
}

export interface ConverterEngine {
  name: string
  supportedInputs: DocumentFormat[]
  supportedOutputs: DocumentFormat[]
  canConvert(from: DocumentFormat, to: DocumentFormat): boolean
  convert(input: Buffer, from: DocumentFormat, to: DocumentFormat, options?: ConversionOptions): Promise<ConversionResult>
  isAvailable(): Promise<boolean>
  getInfo(): ConverterInfo
}

export interface ConverterInfo {
  name: string
  version?: string
  capabilities: string[]
  limitations?: string[]
  requirements?: string[]
}

export class ConversionService {
  private converters: Map<string, ConverterEngine> = new Map()
  private cacheManager?: CacheManager
  private conversionQueue: ConversionJob[] = []
  private processingQueue = false
  private stats = {
    totalConversions: 0,
    successfulConversions: 0,
    failedConversions: 0,
    totalDuration: 0,
    cacheHits: 0
  }

  constructor(options: { 
    cacheManager?: CacheManager
    maxConcurrentJobs?: number
  } = {}) {
    this.cacheManager = options.cacheManager
    this.registerDefaultConverters()
  }

  public async convert(
    input: Buffer,
    from: DocumentFormat,
    to: DocumentFormat,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()
    
    // Check cache first
    if (this.cacheManager) {
      const cacheKey = this.cacheManager.createConversionKey(input, from, to, options)
      const cached = await this.cacheManager.getConversionResult(cacheKey)
      
      if (cached) {
        this.stats.cacheHits++
        return {
          success: true,
          output: cached,
          format: to,
          metadata: {
            originalFormat: from,
            targetFormat: to,
            fileSize: cached.length,
            duration: Date.now() - startTime,
            converter: 'Cache',
            timestamp: new Date(),
            options
          }
        }
      }
    }

    // Find best converter
    const converter = await this.findBestConverter(from, to)
    if (!converter) {
      const result = this.createErrorResult(from, to, startTime, [`No converter available for ${from} to ${to}`])
      this.stats.failedConversions++
      return result
    }

    try {
      // Perform conversion
      const result = await converter.convert(input, from, to, options)
      
      // Update statistics
      this.stats.totalConversions++
      this.stats.totalDuration += result.metadata.duration
      
      if (result.success) {
        this.stats.successfulConversions++
        
        // Cache successful result
        if (this.cacheManager) {
          const cacheKey = this.cacheManager.createConversionKey(input, from, to, options)
          await this.cacheManager.setConversionResult(cacheKey, result.output)
        }
      } else {
        this.stats.failedConversions++
      }
      
      return result
    } catch (error) {
      this.stats.failedConversions++
      return this.createErrorResult(from, to, startTime, [error instanceof Error ? error.message : 'Unknown error'])
    }
  }

  public async convertBatch(jobs: ConversionJob[]): Promise<ConversionResult[]> {
    const results: ConversionResult[] = []
    
    // Process jobs in parallel (respecting concurrency limits)
    const batchSize = 3 // Configurable
    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize)
      const batchPromises = batch.map(job => 
        this.convert(job.input, job.from, job.to, job.options)
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }
    
    return results
  }

  public async findBestConverter(from: DocumentFormat, to: DocumentFormat): Promise<ConverterEngine | null> {
    const availableConverters: ConverterEngine[] = []
    
    // Check availability of all converters
    for (const converter of this.converters.values()) {
      if (converter.canConvert(from, to)) {
        const isAvailable = await converter.isAvailable()
        if (isAvailable) {
          availableConverters.push(converter)
        }
      }
    }
    
    if (availableConverters.length === 0) {
      return null
    }
    
    // Prioritize converters (can be made configurable)
    const priority = ['Chromium', 'LibreOffice', 'ImageMagick', 'Generic']
    
    for (const priorityName of priority) {
      const converter = availableConverters.find(c => c.name === priorityName)
      if (converter) {
        return converter
      }
    }
    
    return availableConverters[0]
  }

  public getSupportedConversions(): Array<{
    from: DocumentFormat
    to: DocumentFormat
    converter: string
    available: boolean
  }> {
    const conversions: Array<{
      from: DocumentFormat
      to: DocumentFormat
      converter: string
      available: boolean
    }> = []
    
    for (const converter of this.converters.values()) {
      for (const inputFormat of converter.supportedInputs) {
        for (const outputFormat of converter.supportedOutputs) {
          if (converter.canConvert(inputFormat, outputFormat)) {
            conversions.push({
              from: inputFormat,
              to: outputFormat,
              converter: converter.name,
              available: true // Could check async availability
            })
          }
        }
      }
    }
    
    return conversions
  }

  public getConverterInfo(): ConverterInfo[] {
    return Array.from(this.converters.values()).map(converter => converter.getInfo())
  }

  public getStats() {
    return {
      ...this.stats,
      averageDuration: this.stats.totalConversions > 0 
        ? this.stats.totalDuration / this.stats.totalConversions 
        : 0,
      successRate: this.stats.totalConversions > 0 
        ? this.stats.successfulConversions / this.stats.totalConversions 
        : 0,
      cacheHitRate: this.stats.totalConversions > 0 
        ? this.stats.cacheHits / this.stats.totalConversions 
        : 0
    }
  }

  public registerConverter(converter: ConverterEngine): void {
    this.converters.set(converter.name, converter)
  }

  public async shutdown(): Promise<void> {
    // Shutdown all converters that support it
    for (const converter of this.converters.values()) {
      if ('shutdown' in converter && typeof converter.shutdown === 'function') {
        await (converter as any).shutdown()
      }
    }
  }

  private registerDefaultConverters(): void {
    // These will be imported and registered
    try {
      const { ChromiumConverter } = require('./ChromiumConverter')
      this.registerConverter(new ChromiumConverter())
    } catch (error) {
      console.warn('Chromium converter not available:', (error as Error).message)
    }
    
    try {
      const { LibreOfficeConverter } = require('./LibreOfficeConverter')
      this.registerConverter(new LibreOfficeConverter())
    } catch (error) {
      console.warn('LibreOffice converter not available:', (error as Error).message)
    }
  }

  private createErrorResult(
    from: DocumentFormat,
    to: DocumentFormat,
    startTime: number,
    errors: string[]
  ): ConversionResult {
    return {
      success: false,
      output: Buffer.alloc(0),
      format: to,
      metadata: {
        originalFormat: from,
        targetFormat: to,
        fileSize: 0,
        duration: Date.now() - startTime,
        converter: 'None',
        timestamp: new Date()
      },
      errors
    }
  }
}

interface ConversionJob {
  input: Buffer
  from: DocumentFormat
  to: DocumentFormat
  options?: ConversionOptions
}

// ============================================================================
// ENHANCED CHROMIUM CONVERTER
// ============================================================================

// src/conversion/ChromiumConverter.ts
export class ChromiumConverter implements ConverterEngine {
  public name = 'Chromium'
  public supportedInputs = [DocumentFormat.HTML]
  public supportedOutputs = [DocumentFormat.PDF]
  
  private browserPool: BrowserPool
  private isInitialized = false

  constructor(poolOptions?: { min?: number; max?: number }) {
    this.browserPool = new BrowserPool(poolOptions)
  }

  public canConvert(from: DocumentFormat, to: DocumentFormat): boolean {
    return this.supportedInputs.includes(from) && this.supportedOutputs.includes(to)
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const puppeteer = require('puppeteer')
      return !!puppeteer
    } catch {
      return false
    }
  }

  public getInfo(): ConverterInfo {
    return {
      name: this.name,
      version: this.getPuppeteerVersion(),
      capabilities: [
        'HTML to PDF conversion',
        'Custom page sizes and margins',
        'Header and footer templates',
        'Print background graphics',
        'Watermarks',
        'PDF metadata'
      ],
      limitations: [
        'Requires Chromium/Chrome installation',
        'Memory intensive for large documents',
        'Limited to HTML input format'
      ],
      requirements: [
        'puppeteer npm package',
        'Chromium or Chrome browser'
      ]
    }
  }

  public async convert(
    input: Buffer,
    from: DocumentFormat,
    to: DocumentFormat,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()

    if (!await this.isAvailable()) {
      return this.createErrorResult(from, to, startTime, ['Puppeteer not available'])
    }

    if (!this.canConvert(from, to)) {
      return this.createErrorResult(from, to, startTime, [`Cannot convert from ${from} to ${to}`])
    }

    try {
      if (!this.isInitialized) {
        await this.browserPool.initialize()
        this.isInitialized = true
      }

      const browser = await this.browserPool.acquire()
      
      try {
        const page = await browser.newPage()
        
        // Set viewport for consistent rendering
        await page.setViewport({
          width: 1200,
          height: 800,
          deviceScaleFactor: 1
        })
        
        // Process HTML content
        let htmlContent = input.toString('utf-8')
        
        // Add watermark if specified
        if (options.watermark) {
          htmlContent = this.addWatermark(htmlContent, options.watermark)
        }
        
        // Set content with proper loading
        await page.setContent(htmlContent, { 
          waitUntil: 'networkidle0',
          timeout: options.timeout || 30000
        })

        // Configure PDF options
        const pdfOptions: any = {
          format: options.pageSize || 'A4',
          landscape: options.orientation === 'landscape',
          printBackground: true,
          preferCSSPageSize: true,
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

        // Set PDF metadata
        if (options.metadata) {
          // Note: Puppeteer doesn't directly support PDF metadata
          // This would need to be added post-generation with another library
        }

        // Generate PDF
        const pdfBuffer = await page.pdf(pdfOptions)
        await page.close()

        return {
          success: true,
          output: Buffer.from(pdfBuffer),
          format: DocumentFormat.PDF,
          metadata: {
            originalFormat: from,
            targetFormat: to,
            fileSize: pdfBuffer.length,
            duration: Date.now() - startTime,
            converter: this.name,
            timestamp: new Date(),
            options
          }
        }
      } finally {
        this.browserPool.release(browser)
      }
    } catch (error) {
      return this.createErrorResult(from, to, startTime, [error instanceof Error ? error.message : 'Unknown error'])
    }
  }

  public async shutdown(): Promise<void> {
    await this.browserPool.shutdown()
    this.isInitialized = false
  }

  private addWatermark(htmlContent: string, watermark: NonNullable<ConversionOptions['watermark']>): string {
    const watermarkStyle = this.getWatermarkStyle(watermark)
    const watermarkHTML = `
      <div style="${watermarkStyle}">
        ${watermark.text}
      </div>
    `
    
    // Insert watermark before closing body tag
    return htmlContent.replace('</body>', watermarkHTML + '</body>')
  }

  private getWatermarkStyle(watermark: NonNullable<ConversionOptions['watermark']>): string {
    const baseStyle = `
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      opacity: ${watermark.opacity};
      font-size: 24px;
      font-weight: bold;
      color: #cccccc;
      transform: rotate(-45deg);
    `
    
    const positionStyles = {
      center: 'top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg);',
      topLeft: 'top: 20px; left: 20px;',
      topRight: 'top: 20px; right: 20px;',
      bottomLeft: 'bottom: 20px; left: 20px;',
      bottomRight: 'bottom: 20px; right: 20px;'
    }
    
    return baseStyle + positionStyles[watermark.position]
  }

  private getPuppeteerVersion(): string {
    try {
      const puppeteer = require('puppeteer')
      return puppeteer.version || 'unknown'
    } catch {
      return 'not installed'
    }
  }

  private createErrorResult(
    from: DocumentFormat,
    to: DocumentFormat,
    startTime: number,
    errors: string[]
  ): ConversionResult {
    return {
      success: false,
      output: Buffer.alloc(0),
      format: to,
      metadata: {
        originalFormat: from,
        targetFormat: to,
        fileSize: 0,
        duration: Date.now() - startTime,
        converter: this.name,
        timestamp: new Date()
      },
      errors
    }
  }
}

// ============================================================================
// BROWSER POOL MANAGEMENT
// ============================================================================

// src/conversion/BrowserPool.ts
export class BrowserPool {
  private browsers: any[] = []
  private availableBrowsers: any[] = []
  private readonly maxBrowsers: number
  private readonly minBrowsers: number
  private isInitialized = false
  private stats = {
    created: 0,
    destroyed: 0,
    acquired: 0,
    released: 0,
    errors: 0
  }

  constructor(options: { min?: number; max?: number } = {}) {
    this.minBrowsers = options.min || 1
    this.maxBrowsers = options.max || 3
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return

    const puppeteer = await this.getPuppeteer()
    if (!puppeteer) {
      throw new Error('Puppeteer not available')
    }

    // Launch minimum number of browsers
    for (let i = 0; i < this.minBrowsers; i++) {
      await this.createBrowser()
    }

    this.isInitialized = true
  }

  public async acquire(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (this.availableBrowsers.length > 0) {
      const browser = this.availableBrowsers.pop()!
      this.stats.acquired++
      return browser
    }

    // Create new browser if under limit
    if (this.browsers.length < this.maxBrowsers) {
      const browser = await this.createBrowser()
      this.stats.acquired++
      return browser
    }

    // Wait for a browser to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Browser pool timeout'))
      }, 30000)

      const checkAvailable = () => {
        if (this.availableBrowsers.length > 0) {
          clearTimeout(timeout)
          const browser = this.availableBrowsers.pop()!
          this.stats.acquired++
          resolve(browser)
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
      this.stats.released++
    }
  }

  public async shutdown(): Promise<void> {
    const closePromises = this.browsers.map(async (browser) => {
      try {
        await browser.close()
        this.stats.destroyed++
      } catch (error) {
        this.stats.errors++
        console.warn('Error closing browser:', error)
      }
    })
    
    await Promise.all(closePromises)
    this.browsers = []
    this.availableBrowsers = []
    this.isInitialized = false
  }

  public getStats() {
    return {
      ...this.stats,
      total: this.browsers.length,
      available: this.availableBrowsers.length,
      busy: this.browsers.length - this.availableBrowsers.length,
      utilization: this.browsers.length > 0 
        ? (this.browsers.length - this.availableBrowsers.length) / this.browsers.length 
        : 0
    }
  }

  private async createBrowser(): Promise<any> {
    const puppeteer = await this.getPuppeteer()
    if (!puppeteer) {
      throw new Error('Puppeteer not available')
    }

    try {
      const browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        timeout: 30000
      })

      // Handle browser disconnection
      browser.on('disconnected', () => {
        this.removeBrowser(browser)
      })

      this.browsers.push(browser)
      this.availableBrowsers.push(browser)
      this.stats.created++
      
      return browser
    } catch (error) {
      this.stats.errors++
      throw new Error(`Failed to create browser: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private removeBrowser(browser: any): void {
    const browserIndex = this.browsers.indexOf(browser)
    if (browserIndex > -1) {
      this.browsers.splice(browserIndex, 1)
    }

    const availableIndex = this.availableBrowsers.indexOf(browser)
    if (availableIndex > -1) {
      this.availableBrowsers.splice(availableIndex, 1)
    }
  }

  private async getPuppeteer(): Promise<any> {
    try {
      return require('puppeteer')
    } catch {
      return null
    }
  }
}

// ============================================================================
// ENHANCED LIBREOFFICE CONVERTER
// ============================================================================

// src/conversion/LibreOfficeConverter.ts
import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import { v4 as uuidv4 } from 'uuid'

export class LibreOfficeConverter implements ConverterEngine {
  public name = 'LibreOffice'
  public supportedInputs = [
    DocumentFormat.DOCX,
    DocumentFormat.ODT,
    DocumentFormat.XLSX,
    DocumentFormat.ODS,
    DocumentFormat.PPTX,
    DocumentFormat.ODP,
    DocumentFormat.TXT,
    DocumentFormat.RTF
  ]
  public supportedOutputs = [
    DocumentFormat.PDF,
    DocumentFormat.DOCX,
    DocumentFormat.ODT,
    DocumentFormat.XLSX,
    DocumentFormat.ODS,
    DocumentFormat.HTML,
    DocumentFormat.TXT
  ]

  private readonly tempDir: string
  private conversionQueue: ConversionJob[] = []
  private processing = false

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'template-engine-libreoffice')
    this.ensureTempDir()
  }

  public canConvert(from: DocumentFormat, to: DocumentFormat): boolean {
    return this.supportedInputs.includes(from) && this.supportedOutputs.includes(to)
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand(['libreoffice', '--version'], 5000)
      return result.success
    } catch {
      return false
    }
  }

  public getInfo(): ConverterInfo {
    return {
      name: this.name,
      capabilities: [
        'Office document conversions',
        'Multiple input/output formats',
        'Batch processing',
        'High fidelity conversion'
      ],
      limitations: [
        'Requires LibreOffice installation',
        'Slower than browser-based conversion',
        'Memory usage scales with document complexity'
      ],
      requirements: [
        'LibreOffice installation',
        'Sufficient disk space for temporary files'
      ]
    }
  }

  public async convert(
    input: Buffer,
    from: DocumentFormat,
    to: DocumentFormat,
    options: ConversionOptions = {}
  ): Promise<ConversionResult> {
    const startTime = Date.now()

    if (!await this.isAvailable()) {
      return this.createErrorResult(from, to, startTime, ['LibreOffice not available'])
    }

    if (!this.canConvert(from, to)) {
      return this.createErrorResult(from, to, startTime, [`Cannot convert from ${from} to ${to}`])
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

      // Execute conversion with timeout
      const result = await this.executeCommand(libreOfficeCmd, options.timeout || 60000)

      if (!result.success) {
        return this.createErrorResult(from, to, startTime, result.errors || ['Conversion failed'])
      }

      // Find and read output file
      const outputFiles = await fs.readdir(outputDir)
      const outputFile = outputFiles.find(file => 
        file.toLowerCase().endsWith(`.${to.toLowerCase()}`)
      )

      if (!outputFile) {
        return this.createErrorResult(from, to, startTime, ['Output file not found'])
      }

      const outputPath = path.join(outputDir, outputFile)
      const outputBuffer = await fs.readFile(outputPath)

      return {
        success: true,
        output: outputBuffer,
        format: to,
        metadata: {
          originalFormat: from,
          targetFormat: to,
          fileSize: outputBuffer.length,
          duration: Date.now() - startTime,
          converter: this.name,
          timestamp: new Date(),
          options
        }
      }
    } catch (error) {
      return this.createErrorResult(from, to, startTime, [
        error instanceof Error ? error.message : 'Unknown error'
      ])
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
      '--invisible',
      '--nodefault',
      '--nolockcheck',
      '--nologo',
      '--norestore'
    ]

    // Add conversion parameters
    const formatFilter = this.getLibreOfficeFilter(targetFormat, options)
    if (formatFilter) {
      cmd.push('--convert-to', formatFilter)
    } else {
      cmd.push('--convert-to', this.getLibreOfficeFormat(targetFormat))
    }

    cmd.push('--outdir', outputDir, inputFile)

    return cmd
  }

  private getLibreOfficeFormat(format: DocumentFormat): string {
    const formatMap: Record<DocumentFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',  // Add
  odp: 'application/vnd.oasis.opendocument.presentation',                              // Add
  html: 'text/html',
  txt: 'text/plain',
  rtf: 'application/rtf',     // Add
  csv: 'text/csv',            // Add
  xml: 'application/xml',     // Add
  md: 'text/markdown'         // Add
}
    
    return formatMap[format] || format
  }

  private getLibreOfficeFilter(format: DocumentFormat, options: ConversionOptions): string | null {
    if (format === DocumentFormat.PDF) {
      const pdfOptions: string[] = []
      
      if (options.quality === 'high') {
        pdfOptions.push('Quality=100')
      } else if (options.quality === 'low') {
        pdfOptions.push('Quality=50')
      }
      
      if (options.pageSize) {
        // LibreOffice uses different page size notation
        pdfOptions.push(`PageSize=${options.pageSize}`)
      }
      
      if (pdfOptions.length > 0) {
        return `pdf:writer_pdf_Export:{"${pdfOptions.join('","')}"}`
      }
    }
    
    return null
  }

  private async executeCommand(
    cmd: string[], 
    timeout: number
  ): Promise<{ success: boolean; errors?: string[] }> {
    return new Promise((resolve) => {
      const childProcess = spawn(cmd[0], cmd.slice(1), {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, HOME: os.tmpdir() }
})

      let stdout = ''
      let stderr = ''
      let timeoutId: NodeJS.Timeout

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId)
        if (!childProcess.killed) {
          childProcess.kill('SIGTERM')
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL')
            }
          }, 5000)
        }
      }

      timeoutId = setTimeout(() => {
        cleanup()
        resolve({
          success: false,
          errors: ['Conversion timeout']
        })
      }, timeout)

childProcess.stdout?.on('data', (data: Buffer) => {    
      stdout += data.toString()
      })

childProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString()
      })

childProcess.on('close', (code: number | null) => {        cleanup()
        
        if (code === 0) {
          resolve({ success: true })
        } else {
          resolve({
            success: false,
            errors: [stderr || `Process exited with code ${code}`]
          })
        }
      })

childProcess.on('error', (error: Error) => {        cleanup()
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

  private createErrorResult(
    from: DocumentFormat,
    to: DocumentFormat,
    startTime: number,
    errors: string[]
  ): ConversionResult {
    return {
      success: false,
      output: Buffer.alloc(0),
      format: to,
      metadata: {
        originalFormat: from,
        targetFormat: to,
        fileSize: 0,
        duration: Date.now() - startTime,
        converter: this.name,
        timestamp: new Date()
      },
      errors
    }
  }
}

interface ConversionJob {
  id: string
  input: Buffer
  from: DocumentFormat
  to: DocumentFormat
  options?: ConversionOptions
  priority: number
  createdAt: Date
}