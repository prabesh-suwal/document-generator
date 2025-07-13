
import JSZip from 'jszip'
import { parseString, Builder } from 'xml2js'
import * as mammoth from 'mammoth'
import * as ExcelJS from 'exceljs'
import { parse as parseHTML } from 'node-html-parser'
import { DocumentFormat, EngineConfig, ParsedTemplate, ProcessedData, RenderedDocument, RenderRequest } from '../types/core'
import { TemplateEngine } from '../engine/TemplateEngine'

// ============================================================================
// 1. CORE INTERFACES
// ============================================================================

export interface DocumentFormatHandler {
  supportedFormats: DocumentFormat[]
  canHandle(format: DocumentFormat): boolean
  parse(content: Buffer, format: DocumentFormat): Promise<ParsedDocument>
  render(template: ParsedDocument, data: ProcessedData): Promise<RenderedDocument>
  convert?(from: DocumentFormat, to: DocumentFormat, content: Buffer): Promise<Buffer>
}

export interface ParsedDocument {
  format: DocumentFormat
  content: string | DocumentStructure
  metadata: DocumentMetadata
  assets?: Map<string, Buffer> // Images, styles, etc.
}

export interface DocumentStructure {
  type: 'xml' | 'office' | 'html' | 'text'
  root: any
  relationships?: any[]
  styles?: any[]
  images?: Map<string, Buffer>
}

export interface DocumentMetadata {
  title?: string
  author?: string
  created?: Date
  modified?: Date
  pageCount?: number
  wordCount?: number
  properties?: Record<string, any>
}

// ============================================================================
// 2. FORMAT HANDLER REGISTRY
// ============================================================================

export class FormatHandlerRegistry {
  private handlers: Map<DocumentFormat, DocumentFormatHandler> = new Map()

  public registerHandler(handler: DocumentFormatHandler): void {
    for (const format of handler.supportedFormats) {
      this.handlers.set(format, handler)
    }
  }

  public getHandler(format: DocumentFormat): DocumentFormatHandler | undefined {
    return this.handlers.get(format)
  }

  public getSupportedFormats(): DocumentFormat[] {
    return Array.from(this.handlers.keys())
  }

  public canHandle(format: DocumentFormat): boolean {
    return this.handlers.has(format)
  }
}

// ============================================================================
// 3. TEXT HANDLER (TXT, MD)
// ============================================================================

export class TextFormatHandler implements DocumentFormatHandler {
  public supportedFormats = [DocumentFormat.TXT, DocumentFormat.MARKDOWN]

  public canHandle(format: DocumentFormat): boolean {
    return this.supportedFormats.includes(format)
  }

  public async parse(content: Buffer, format: DocumentFormat): Promise<ParsedDocument> {
    const textContent = content.toString('utf-8')
    
    return {
      format,
      content: textContent,
      metadata: {
        wordCount: textContent.split(/\s+/).length,
        created: new Date(),
        modified: new Date()
      }
    }
  }

  public async render(template: ParsedDocument, data: ProcessedData): Promise<RenderedDocument> {
    // For text formats, content is already processed by the main engine
    const content = Buffer.from(template.content as string, 'utf-8')
    
    return {
      content,
      format: template.format,
      metadata: {
        templateId: 'text-template',
        renderTime: new Date(),
        duration: 0,
        outputSize: content.length
      },
      warnings: []
    }
  }
}

// ============================================================================
// 4. HTML HANDLER
// ============================================================================

export class HtmlFormatHandler implements DocumentFormatHandler {
  public supportedFormats = [DocumentFormat.HTML]

  public canHandle(format: DocumentFormat): boolean {
    return format === DocumentFormat.HTML
  }

  public async parse(content: Buffer, format: DocumentFormat): Promise<ParsedDocument> {
    const htmlContent = content.toString('utf-8')
    const root = parseHTML(htmlContent)
    
    return {
      format,
      content: {
        type: 'html',
        root,
        images: new Map()
      },
      metadata: {
        title: root.querySelector('title')?.text || 'Untitled',
        created: new Date(),
        modified: new Date()
      }
    }
  }

  public async render(template: ParsedDocument, data: ProcessedData): Promise<RenderedDocument> {
    let htmlContent: string

    if (typeof template.content === 'string') {
      htmlContent = template.content
    } else {
      // Reconstruct HTML from parsed structure
      const structure = template.content as DocumentStructure
      htmlContent = structure.root.toString()
    }

    // Ensure proper HTML structure
    if (!htmlContent.includes('<html>')) {
      htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Generated Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .template-content { line-height: 1.6; }
    </style>
</head>
<body>
    <div class="template-content">
        ${htmlContent}
    </div>
</body>
</html>`
    }

    const content = Buffer.from(htmlContent, 'utf-8')
    
    return {
      content,
      format: template.format,
      metadata: {
        templateId: 'html-template',
        renderTime: new Date(),
        duration: 0,
        outputSize: content.length
      },
      warnings: []
    }
  }
}

// ============================================================================
// 5. DOCX HANDLER (Office Open XML)
// ============================================================================

export class DocxFormatHandler implements DocumentFormatHandler {
  public supportedFormats = [DocumentFormat.DOCX]

  public canHandle(format: DocumentFormat): boolean {
    return format === DocumentFormat.DOCX
  }

  public async parse(content: Buffer, format: DocumentFormat): Promise<ParsedDocument> {
    try {
      const zip = await JSZip.loadAsync(content)
      
      // Extract main document
      const documentXml = await zip.file('word/document.xml')?.async('string')
      if (!documentXml) {
        throw new Error('Invalid DOCX: missing document.xml')
      }

      // Parse document XML
      const parsedDoc = await this.parseXml(documentXml)
      
      // Extract relationships
      const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string')
      const relationships = relsXml ? await this.parseXml(relsXml) : null

      // Extract styles
      const stylesXml = await zip.file('word/styles.xml')?.async('string')
      const styles = stylesXml ? await this.parseXml(stylesXml) : null

      // Extract images
      const images = new Map<string, Buffer>()
      const mediaFolder = zip.folder('word/media')
      if (mediaFolder) {
        for (const [filename, file] of Object.entries(mediaFolder.files)) {
          if (!file.dir) {
            const imageBuffer = await file.async('nodebuffer')
            images.set(filename, imageBuffer)
          }
        }
      }

      // Extract metadata
      const coreXml = await zip.file('docProps/core.xml')?.async('string')
      const metadata = await this.extractMetadata(coreXml)

      return {
        format,
        content: {
          type: 'office',
          root: parsedDoc,
          relationships: relationships ? [relationships] : [],
          styles: styles ? [styles] : [],
          images
        },
        metadata,
        assets: images
      }
    } catch (error) {
      throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async render(template: ParsedDocument, data: ProcessedData): Promise<RenderedDocument> {
    try {
      const structure = template.content as DocumentStructure
      
      // Process the document content with template data
      const processedDoc = this.processDocumentContent(structure.root, data)
      
      // Convert back to XML
      const builder = new Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
        renderOpts: { pretty: false }
      })
      const documentXml = builder.buildObject(processedDoc)

      // Create new DOCX file
      const zip = new JSZip()
      
      // Add required DOCX structure
      this.addDocxStructure(zip, documentXml, structure)
      
      // Generate the DOCX buffer
      const docxBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })

      return {
        content: docxBuffer,
        format: DocumentFormat.DOCX,
        metadata: {
          templateId: 'docx-template',
          renderTime: new Date(),
          duration: 0,
          outputSize: docxBuffer.length
        },
        warnings: []
      }
    } catch (error) {
      throw new Error(`Failed to render DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async parseXml(xmlString: string): Promise<any> {
    return new Promise((resolve, reject) => {
      parseString(xmlString, { explicitArray: false, ignoreAttrs: false }, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
  }

  private processDocumentContent(doc: any, data: ProcessedData): any {
    // Deep clone the document structure
    const processedDoc = JSON.parse(JSON.stringify(doc))
    
    // Process text content in the document
    this.processTextNodes(processedDoc, data)
    
    return processedDoc
  }

  private processTextNodes(node: any, data: ProcessedData): void {
    if (typeof node === 'string') {
      return // Text already processed by main engine
    }
    
    if (Array.isArray(node)) {
      node.forEach(item => this.processTextNodes(item, data))
      return
    }
    
    if (typeof node === 'object' && node !== null) {
      // Look for text nodes in Word XML structure
      if (node['w:t']) {
        // This is a text node - content already processed by main engine
        return
      }
      
      // Recursively process all properties
      Object.values(node).forEach(value => this.processTextNodes(value, data))
    }
  }

  private addDocxStructure(zip: JSZip, documentXml: string, structure: DocumentStructure): void {
    // Add Content_Types
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)

    // Add main relationships
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

    // Add document relationships
    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`)

    // Add main document
    zip.file('word/document.xml', documentXml)

    // Add styles
    zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:docDefaults>
        <w:rPrDefault>
            <w:rPr>
                <w:rFonts w:ascii="Times New Roman" w:eastAsia="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            </w:rPr>
        </w:rPrDefault>
    </w:docDefaults>
</w:styles>`)

    // Add images if any
    if (structure.images) {
      for (const [filename, buffer] of structure.images.entries()) {
        zip.file(`word/media/${filename}`, buffer)
      }
    }
  }

  private async extractMetadata(coreXml?: string): Promise<DocumentMetadata> {
    if (!coreXml) {
      return {
        created: new Date(),
        modified: new Date()
      }
    }

    try {
      const parsed = await this.parseXml(coreXml)
      const props = parsed['cp:coreProperties'] || {}
      
      return {
        title: props['dc:title'] || 'Untitled',
        author: props['dc:creator'] || 'Unknown',
        created: props['dcterms:created'] ? new Date(props['dcterms:created']) : new Date(),
        modified: props['dcterms:modified'] ? new Date(props['dcterms:modified']) : new Date()
      }
    } catch {
      return {
        created: new Date(),
        modified: new Date()
      }
    }
  }
}

// ============================================================================
// 6. XLSX HANDLER (Excel)
// ============================================================================

export class XlsxFormatHandler implements DocumentFormatHandler {
  public supportedFormats = [DocumentFormat.XLSX]

  public canHandle(format: DocumentFormat): boolean {
    return format === DocumentFormat.XLSX
  }

  public async parse(content: Buffer, format: DocumentFormat): Promise<ParsedDocument> {
    try {
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(content)
      
      // Extract workbook structure
      const worksheets = workbook.worksheets.map(sheet => ({
        name: sheet.name,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        data: this.extractSheetData(sheet)
      }))

      return {
        format,
        content: {
          type: 'office',
          root: {
            worksheets,
            properties: workbook.properties
          }
        },
        metadata: {
          title: (workbook.properties as any).title || 'Untitled Workbook',
          author: (workbook.properties as any).creator || 'Unknown',
          created: (workbook.properties as any).created || new Date(),
          modified: (workbook.properties as any).modified || new Date()
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse XLSX: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async render(template: ParsedDocument, data: ProcessedData): Promise<RenderedDocument> {
    try {
      const workbook = new ExcelJS.Workbook()
      const structure = template.content as DocumentStructure
      const worksheetData = structure.root.worksheets

      // Recreate worksheets
      for (const sheetData of worksheetData) {
        const worksheet = workbook.addWorksheet(sheetData.name)
        
        // Add data to worksheet
        for (let rowIndex = 0; rowIndex < sheetData.data.length; rowIndex++) {
          const rowData = sheetData.data[rowIndex]
          for (let colIndex = 0; colIndex < rowData.length; colIndex++) {
            const cell = worksheet.getCell(rowIndex + 1, colIndex + 1)
            cell.value = rowData[colIndex]
          }
        }
      }

      // Generate XLSX buffer
      const xlsxBuffer = await workbook.xlsx.writeBuffer()

      return {
        content: Buffer.from(xlsxBuffer),
        format: DocumentFormat.XLSX,
        metadata: {
          templateId: 'xlsx-template',
          renderTime: new Date(),
          duration: 0,
          outputSize: xlsxBuffer.byteLength
        },
        warnings: []
      }
    } catch (error) {
      throw new Error(`Failed to render XLSX: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private extractSheetData(sheet: ExcelJS.Worksheet): any[][] {
    const data: any[][] = []
    
    sheet.eachRow((row, rowNumber) => {
      const rowData: any[] = []
      row.eachCell((cell, colNumber) => {
        rowData[colNumber - 1] = cell.value
      })
      data[rowNumber - 1] = rowData
    })
    
    return data
  }
}

// ============================================================================
// 7. ODT HANDLER (OpenDocument Text)
// ============================================================================

export class OdtFormatHandler implements DocumentFormatHandler {
  public supportedFormats = [DocumentFormat.ODT]

  public canHandle(format: DocumentFormat): boolean {
    return format === DocumentFormat.ODT
  }

  public async parse(content: Buffer, format: DocumentFormat): Promise<ParsedDocument> {
    try {
      const zip = await JSZip.loadAsync(content)
      
      // Extract main content
      const contentXml = await zip.file('content.xml')?.async('string')
      if (!contentXml) {
        throw new Error('Invalid ODT: missing content.xml')
      }

      // Parse content XML
      const parsedContent = await this.parseXml(contentXml)
      
      // Extract styles
      const stylesXml = await zip.file('styles.xml')?.async('string')
      const styles = stylesXml ? await this.parseXml(stylesXml) : null

      // Extract metadata
      const metaXml = await zip.file('meta.xml')?.async('string')
      const metadata = await this.extractOdtMetadata(metaXml)

      return {
        format,
        content: {
          type: 'office',
          root: parsedContent,
          styles: styles ? [styles] : []
        },
        metadata
      }
    } catch (error) {
      throw new Error(`Failed to parse ODT: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  public async render(template: ParsedDocument, data: ProcessedData): Promise<RenderedDocument> {
    try {
      const structure = template.content as DocumentStructure
      
      // Process the content
      const processedContent = this.processOdtContent(structure.root, data)
      
      // Convert back to XML
      const builder = new Builder({
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: false }
      })
      const contentXml = builder.buildObject(processedContent)

      // Create new ODT file
      const zip = new JSZip()
      this.addOdtStructure(zip, contentXml, structure)
      
      // Generate the ODT buffer
      const odtBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE'
      })

      return {
        content: odtBuffer,
        format: DocumentFormat.ODT,
        metadata: {
          templateId: 'odt-template',
          renderTime: new Date(),
          duration: 0,
          outputSize: odtBuffer.length
        },
        warnings: []
      }
    } catch (error) {
      throw new Error(`Failed to render ODT: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async parseXml(xmlString: string): Promise<any> {
    return new Promise((resolve, reject) => {
      parseString(xmlString, { explicitArray: false, ignoreAttrs: false }, (err, result) => {
        if (err) reject(err)
        else resolve(result)
      })
    })
  }

  private processOdtContent(content: any, data: ProcessedData): any {
    // Process ODT-specific content structure
    const processedContent = JSON.parse(JSON.stringify(content))
    this.processOdtTextNodes(processedContent, data)
    return processedContent
  }

  private processOdtTextNodes(node: any, data: ProcessedData): void {
    if (typeof node === 'string') {
      return // Text already processed by main engine
    }
    
    if (Array.isArray(node)) {
      node.forEach(item => this.processOdtTextNodes(item, data))
      return
    }
    
    if (typeof node === 'object' && node !== null) {
      // Look for text nodes in ODT XML structure
      if (node['text:p'] || node['text:span']) {
        // Text content already processed by main engine
        return
      }
      
      // Recursively process all properties
      Object.values(node).forEach(value => this.processOdtTextNodes(value, data))
    }
  }

  private addOdtStructure(zip: JSZip, contentXml: string, structure: DocumentStructure): void {
    // Add manifest
    zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
    <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
    <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
    <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
    <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`)

    // Add content
    zip.file('content.xml', contentXml)

    // Add basic styles
    zip.file('styles.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0">
    <office:styles>
        <style:default-style style:family="paragraph">
            <style:paragraph-properties style:writing-mode="page"/>
            <style:text-properties style:font-name="Liberation Serif"/>
        </style:default-style>
    </office:styles>
</office:document-styles>`)

    // Add metadata
    zip.file('meta.xml', `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0">
    <office:meta>
        <meta:creation-date>${new Date().toISOString()}</meta:creation-date>
        <meta:generator>Template Engine</meta:generator>
    </office:meta>
</office:document-meta>`)

    // Add MIME type
    zip.file('mimetype', 'application/vnd.oasis.opendocument.text')
  }

  private async extractOdtMetadata(metaXml?: string): Promise<DocumentMetadata> {
    if (!metaXml) {
      return {
        created: new Date(),
        modified: new Date()
      }
    }

    try {
      const parsed = await this.parseXml(metaXml)
      const meta = parsed['office:document-meta']?.['office:meta'] || {}
      
      return {
        title: meta['dc:title'] || 'Untitled',
        author: meta['meta:initial-creator'] || 'Unknown',
        created: meta['meta:creation-date'] ? new Date(meta['meta:creation-date']) : new Date(),
        modified: meta['dc:date'] ? new Date(meta['dc:date']) : new Date()
      }
    } catch {
      return {
        created: new Date(),
        modified: new Date()
      }
    }
  }
}

// ============================================================================
// 8. ENHANCED TEMPLATE ENGINE WITH FORMAT SUPPORT
// ============================================================================

export class EnhancedTemplateEngine extends TemplateEngine {
  private formatRegistry: FormatHandlerRegistry

  constructor(config?: Partial<EngineConfig>) {
    super(config)
    this.formatRegistry = new FormatHandlerRegistry()
    this.registerDefaultHandlers()
  }

  public async renderWithFormat(request: RenderRequest): Promise<RenderedDocument> {
    const inputFormat = request.template.format || DocumentFormat.TXT
    const outputFormat = request.options?.convertTo || inputFormat

    // Get appropriate handler for input format
    const inputHandler = this.formatRegistry.getHandler(inputFormat)
    if (!inputHandler) {
      throw new Error(`Unsupported input format: ${inputFormat}`)
    }

    // Parse the template with format-specific handler
    let parsedDoc: ParsedDocument
    if (request.template.content) {
      const content = typeof request.template.content === 'string' 
        ? Buffer.from(request.template.content, 'utf-8')
        : request.template.content
      parsedDoc = await inputHandler.parse(content, inputFormat)
    } else {
      throw new Error('Template content must be provided')
    }

    // Process the template content with our main engine
    const templateContent = typeof parsedDoc.content === 'string' 
      ? parsedDoc.content 
      : this.extractTextFromStructure(parsedDoc.content)

    const mainEngineResult = await super.render({
      template: { content: templateContent, format: inputFormat },
      data: request.data,
      options: request.options
    })

    // Update parsed document with processed content
    parsedDoc.content = mainEngineResult.content.toString('utf-8')

    // Render with format-specific handler
    const outputHandler = this.formatRegistry.getHandler(outputFormat)
    if (!outputHandler) {
      throw new Error(`Unsupported output format: ${outputFormat}`)
    }

    // Create processed data structure
    const processedData: ProcessedData = {
      main: request.data,
      computed: new Map(),
      aggregations: new Map(),
      metadata: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        dataSize: JSON.stringify(request.data).length,
        tagCount: 0,
        errors: [],
        warnings: []
      }
    }

    return await outputHandler.render(parsedDoc, processedData)
  }

  private extractTextFromStructure(structure: DocumentStructure): string {
    // For now, return a simple text representation
    // In a full implementation, this would extract text from complex structures
    if (typeof structure === 'string') {
      return structure
    }
    
    return JSON.stringify(structure, null, 2)
  }

  private registerDefaultHandlers(): void {
    this.formatRegistry.registerHandler(new TextFormatHandler())
    this.formatRegistry.registerHandler(new HtmlFormatHandler())
    this.formatRegistry.registerHandler(new DocxFormatHandler())
    this.formatRegistry.registerHandler(new XlsxFormatHandler())
    this.formatRegistry.registerHandler(new OdtFormatHandler())
  }

  public getSupportedFormats(): DocumentFormat[] {
    return this.formatRegistry.getSupportedFormats()
  }

  public canHandleFormat(format: DocumentFormat): boolean {
    return this.formatRegistry.canHandle(format)
  }
}

// ============================================================================
// 9. USAGE EXAMPLES
// ============================================================================

/*
// Example: Render DOCX template
const engine = new EnhancedTemplateEngine()

// Load DOCX template
const docxTemplate = fs.readFileSync('invoice-template.docx')

const result = await engine.renderWithFormat({
  template: {
    content: docxTemplate,
    format: DocumentFormat.DOCX
  },
  data: {
    customer: { name: 'John Doe', email: 'john@example.com' },
    items: [
      { name: 'Laptop', quantity: 1, price: 999.99 },
      { name: 'Mouse', quantity: 2, price: 25.99 }
    ]
  },
  options: {
    convertTo: DocumentFormat.PDF // Convert to PDF
  }
})

// Save result
fs.writeFileSync('generated-invoice.pdf', result.content)

// Example: HTML to PDF conversion
const htmlResult = await engine.renderWithFormat({
  template: {
    content: '<h1>Hello {d.name}!</h1><p>Your score: {d.score}</p>',
    format: DocumentFormat.HTML
  },
  data: { name: 'Alice', score: 95 },
  options: { convertTo: DocumentFormat.PDF }
})

// Example: Excel template processing
const xlsxTemplate = fs.readFileSync('data-template.xlsx')
const excelResult = await engine.renderWithFormat({
  template: {
    content: xlsxTemplate,
    format: DocumentFormat.XLSX
  },
  data: {
    reports: [
      { month: 'January', sales: 50000, profit: 12000 },
      { month: 'February', sales: 55000, profit: 14000 }
    ]
  }
})
*/
