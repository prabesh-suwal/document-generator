
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
      htmlContent = this.wrapInHtmlStructure(htmlContent)
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

  private wrapInHtmlStructure(content: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Document</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            line-height: 1.6;
            color: #333;
        }
        .template-content { 
            max-width: 800px;
            margin: 0 auto;
        }
        h1, h2, h3 { color: #2c3e50; }
        table { 
            border-collapse: collapse; 
            width: 100%; 
            margin: 20px 0;
        }
        th, td { 
            border: 1px solid #ddd; 
            padding: 12px; 
            text-align: left; 
        }
        th { 
            background-color: #f8f9fa; 
            font-weight: 600;
        }
        .invoice-header { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px;
        }
        .invoice-total { 
            font-size: 1.2em; 
            font-weight: bold; 
            color: #27ae60;
        }
    </style>
</head>
<body>
    <div class="template-content">
        ${content}
    </div>
</body>
</html>`
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
    if (structure.images && structure.images instanceof Map) {
      for (const [filename, imageBuffer] of structure.images.entries()) {
        zip.file(`word/media/${filename}`, imageBuffer)
      }
    } else if (structure.images && typeof structure.images === 'object') {
      // Handle case where images is a plain object
      for (const [filename, imageBuffer] of Object.entries(structure.images)) {
        if (imageBuffer instanceof Buffer) {
          zip.file(`word/media/${filename}`, imageBuffer)
        }
      }
    }

    // Add relationships if they exist
    if (structure.relationships && Array.isArray(structure.relationships)) {
      structure.relationships.forEach((rel, index) => {
        if (rel) {
          const builder = new Builder({
            xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
            renderOpts: { pretty: false }
          })
          const relXml = builder.buildObject(rel)
          zip.file(`word/_rels/document.xml.rels`, relXml)
        }
      })
    }

     // Add styles if they exist
    if (structure.styles && Array.isArray(structure.styles)) {
      structure.styles.forEach((style, index) => {
        if (style) {
          const builder = new Builder({
            xmldec: { version: '1.0', encoding: 'UTF-8', standalone: true },
            renderOpts: { pretty: false }
          })
          const styleXml = builder.buildObject(style)
          zip.file(`word/styles.xml`, styleXml)
        }
      })
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

  // For DOCX files, process templates directly in the original structure
  if (inputFormat === DocumentFormat.DOCX) {
    return await this.processDocxTemplateInPlace(parsedDoc, request.data, outputFormat)
  }

  // For other formats, use the existing logic
  const templateContent = typeof parsedDoc.content === 'string' 
    ? parsedDoc.content 
    : JSON.stringify(parsedDoc.content)

  const renderResult = await this.render({
    template: {
      content: templateContent,
      format: DocumentFormat.TXT
    },
    data: request.data,
    options: request.options
  })

  return renderResult
}

/**
 * Process DOCX template in-place - MAINTAINS DOCUMENT ORDER
 */
private async processDocxTemplateInPlace(parsedDoc: ParsedDocument, data: any, outputFormat: DocumentFormat): Promise<RenderedDocument> {
  try {
    console.log('🎯 Processing DOCX template in-place (maintaining document order)...')
    
    const structure = parsedDoc.content as DocumentStructure
    const workingStructure = JSON.parse(JSON.stringify(structure))
    
    // Process the document body sequentially to maintain order
    if (workingStructure.root['w:document'] && workingStructure.root['w:document']['w:body']) {
      const body = workingStructure.root['w:document']['w:body']
      await this.processDocumentBodySequentially(body, data)
    } else {
      console.log('⚠️ Document body not found, falling back to general processing')
      // Fallback: process all elements
      await this.processElementSequentially(workingStructure.root, data)
    }
    
    // Create final document
    const processedData: ProcessedData = {
      main: data,
      complement: {},
      computed: new Map(),
      aggregations: new Map(),
      metadata: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        dataSize: JSON.stringify(data).length,
        tagCount: 0,
        errors: [],
        warnings: []
      }
    }
    
    const docxHandler = this.formatRegistry.getHandler(DocumentFormat.DOCX)
    if (!docxHandler) {
      throw new Error('DOCX handler not available')
    }
    
    const finalParsedDoc: ParsedDocument = {
      format: DocumentFormat.DOCX,
      content: workingStructure,
      metadata: parsedDoc.metadata,
      assets: parsedDoc.assets
    }
    
    return await docxHandler.render(finalParsedDoc, processedData)
    
  } catch (error) {
    throw new Error(`Failed to process DOCX template in-place: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Process document body sequentially to maintain order
 */
private async processDocumentBodySequentially(body: any, data: any): Promise<void> {
  console.log('📄 Processing document body sequentially...')
  
  // Handle the body structure
  if (Array.isArray(body)) {
    console.log('📄 Body is array, processing each element in order')
    for (let i = 0; i < body.length; i++) {
      console.log(`📄 Processing body element ${i + 1}/${body.length}`)
      await this.processElementSequentially(body[i], data)
    }
  } else if (typeof body === 'object' && body !== null) {
    console.log('📄 Body is object, processing properties in order')
    
    // Get all keys and sort them to maintain a consistent order
    const bodyKeys = Object.keys(body)
    console.log('📄 Body keys:', bodyKeys)
    
    // Process each property in the body
    for (const key of bodyKeys) {
      if (key === '$') continue // Skip XML attributes
      
      console.log(`📄 Processing body.${key}`)
      const element = body[key]
      
      if (Array.isArray(element)) {
        // Process array elements in order
        for (let i = 0; i < element.length; i++) {
          console.log(`📄 Processing body.${key}[${i}]`)
          await this.processElementSequentially(element[i], data)
        }
      } else {
        await this.processElementSequentially(element, data)
      }
    }
  }
}

/**
 * Process an individual element sequentially
 */
private async processElementSequentially(element: any, data: any): Promise<void> {
  if (typeof element !== 'object' || element === null) {
    return
  }
  
  // Check what type of element this is
  if (element['w:tbl']) {
    console.log('📋 Found table, processing for row iteration...')
    const wasProcessed = await this.processTableForRowIteration(element['w:tbl'], data)
    if (wasProcessed) {
      console.log('✅ Table processed with row iteration')
    } else {
      console.log('ℹ️ Table processed normally (no row iteration)')
      // Process text nodes in the table normally
      await this.processTextNodesInElement(element, data)
    }
  } else if (element['w:p']) {
    console.log('📝 Found paragraph, processing text nodes...')
    await this.processTextNodesInElement(element, data)
  } else if (element['w:r']) {
    console.log('📝 Found text run, processing text nodes...')
    await this.processTextNodesInElement(element, data)
  } else {
    // For other elements, recursively process
    console.log('📄 Processing other element:', Object.keys(element))
    for (const key in element) {
      if (element.hasOwnProperty(key) && key !== '$') {
        if (Array.isArray(element[key])) {
          for (const item of element[key]) {
            await this.processElementSequentially(item, data)
          }
        } else {
          await this.processElementSequentially(element[key], data)
        }
      }
    }
  }
}

/**
 * Process text nodes in a specific element
 */
private async processTextNodesInElement(element: any, data: any): Promise<void> {
  const textNodes = this.findAllTextNodesInElement(element)
  
  for (const textNodeInfo of textNodes) {
    const originalText = textNodeInfo.text
    
    if (this.containsTemplateTags(originalText)) {
      console.log(`  🔄 Processing text: "${originalText}"`)
      
      try {
        const processedResult = await this.render({
          template: {
            content: originalText,
            format: DocumentFormat.TXT
          },
          data: data
        })
        
        const processedText = processedResult.content.toString()
        console.log(`  ✅ Processed: "${originalText}" → "${processedText}"`)
        
        this.replaceTextInNode(textNodeInfo.node, processedText)
      } catch (error) {
        console.log(`  ❌ Error processing "${originalText}":`, error)
      }
    }
  }
}

/**
 * Process table for row iteration - ENHANCED WITH BETTER LOGGING
 */
private async processTableForRowIteration(table: any, data: any): Promise<boolean> {
  console.log('  📋 Processing table for row iteration...')
  console.log('  📋 Table keys:', Object.keys(table || {}))
  
  // Handle standard table structure (w:tr array)
  if (table['w:tr']) {
    console.log('  📋 Standard table structure detected')
    const rows = Array.isArray(table['w:tr']) ? table['w:tr'] : [table['w:tr']]
    console.log(`  📋 Table has ${rows.length} rows`)
    
    // Find rows that contain array iteration tags
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]
      const arrayIterationInfo = this.findArrayIterationInRow(row)
      
      if (arrayIterationInfo) {
        console.log(`  🔄 Found array iteration in row ${rowIndex}: ${arrayIterationInfo.arrayPath}`)
        
        // Get the array data
        const arrayData = this.getArrayDataFromPath(arrayIterationInfo.arrayPath, data)
        console.log(`  📊 Array data length: ${arrayData.length}`)
        
        if (Array.isArray(arrayData) && arrayData.length > 0) {
          console.log(`  📊 Creating ${arrayData.length} rows for array data`)
          
          // Create multiple rows from this template row
          const newRows = []
          
          // Keep rows before this one
          for (let i = 0; i < rowIndex; i++) {
            newRows.push(rows[i])
          }
          
          // Create a row for each array item
          for (let itemIndex = 0; itemIndex < arrayData.length; itemIndex++) {
            const newRow = JSON.parse(JSON.stringify(row)) // Clone the row
            console.log(`    🔄 Processing item ${itemIndex}: ${arrayData[itemIndex].description || 'item'}`)
            
            // Process all text nodes in this row
            await this.processRowForItem(newRow, itemIndex, data)
            
            newRows.push(newRow)
          }
          
          // Keep rows after this one
          for (let i = rowIndex + 1; i < rows.length; i++) {
            newRows.push(rows[i])
          }
          
          // Replace the table rows
          table['w:tr'] = newRows
          console.log(`  ✅ Replaced table rows: ${rows.length} → ${newRows.length}`)
          
          return true // Successfully processed
        } else {
          console.log(`  ⚠️ No array data found for path: ${arrayIterationInfo.arrayPath}`)
        }
      }
    }
    
    console.log('  ℹ️ No array iteration found in this table')
    return false
    
  } else {
    console.log('  ⚠️ Non-standard table structure, processing text nodes normally')
    return false
  }
}

/**
 * Find array iteration pattern in a table row
 */
private findArrayIterationInRow(row: any): {arrayPath: string, pattern: string} | null {
  const textNodes = this.findAllTextNodesInElement(row)
  
  for (const textNode of textNodes) {
    const text = textNode.text
    // Look for array iteration pattern like {d.items[i].description}
    const match = text.match(/\{d\.([^[]+)\[i\][^}]*\}/)
    if (match) {
      return {
        arrayPath: `d.${match[1]}`,
        pattern: match[0]
      }
    }
  }
  
  return null
}

/**
 * Process a row for a specific array item
 */
private async processRowForItem(row: any, itemIndex: number, data: any): Promise<void> {
  const textNodes = this.findAllTextNodesInElement(row)
  
  for (const textNodeInfo of textNodes) {
    const originalText = textNodeInfo.text
    
    // Replace [i] with the actual index
    const textWithIndex = originalText.replace(/\[i\]/g, `[${itemIndex}]`)
    
    try {
      const processedResult = await this.render({
        template: {
          content: textWithIndex,
          format: DocumentFormat.TXT
        },
        data: data
      })
      
      const processedText = processedResult.content.toString()
      this.replaceTextInNode(textNodeInfo.node, processedText)
    } catch (error) {
      console.log(`      ❌ Error processing "${textWithIndex}": ${error}`)
    }
  }
}

/**
 * Get array data from path
 */
private getArrayDataFromPath(arrayPath: string, data: any): any[] {
  const pathSegments = arrayPath.split('.')
  let current = data
  
  for (const segment of pathSegments) {
    if (segment === 'd') continue
    if (current && typeof current === 'object' && segment in current) {
      current = current[segment]
    } else {
      return []
    }
  }
  
  return Array.isArray(current) ? current : []
}

/**
 * Find all text nodes in an element
 */
private findAllTextNodesInElement(element: any, textNodes: Array<{node: any, text: string}> = []): Array<{node: any, text: string}> {
  if (typeof element === 'object' && element !== null) {
    if (element['w:t']) {
      const text = typeof element['w:t'] === 'string' ? element['w:t'] : element['w:t']._
      if (text) {
        textNodes.push({
          node: element,
          text: text
        })
      }
    }
    
    for (const key in element) {
      if (element.hasOwnProperty(key) && key !== '$') {
        if (Array.isArray(element[key])) {
          element[key].forEach((item: any) => this.findAllTextNodesInElement(item, textNodes))
        } else {
          this.findAllTextNodesInElement(element[key], textNodes)
        }
      }
    }
  }
  
  return textNodes
}

/**
 * Check if text contains template tags
 */
private containsTemplateTags(text: string): boolean {
  const patterns = [
    /\{d\.[^}]+\}/,
    /\{c\.[^}]+\}/,
    /\{t\([^}]+\)\}/,
    /\{#\s[^}]+\}/,
    /\{o\.[^}]+\}/
  ]
  
  return patterns.some(pattern => pattern.test(text))
}

/**
 * Replace text content in a node
 */
private replaceTextInNode(node: any, newText: string): void {
  if (node['w:t']) {
    if (typeof node['w:t'] === 'string') {
      node['w:t'] = newText
    } else if (node['w:t']._) {
      node['w:t']._ = newText
    }
  }
}

/**
 * Find all tables in the document with their paths
 */
private findAllTablesInDocument(node: any, tables: Array<{table: any, path: string}> = [], path: string = ''): Array<{table: any, path: string}> {
  if (typeof node === 'object' && node !== null) {
    // Check if this node contains table(s)
    if (node['w:tbl']) {
      console.log(`  📋 Found w:tbl at path: ${path}`)
      
      // Handle both single table and array of tables
      if (Array.isArray(node['w:tbl'])) {
        console.log(`  📋 Multiple tables found: ${node['w:tbl'].length}`)
        node['w:tbl'].forEach((table: any, index: number) => {
          tables.push({
            table: table,
            path: `${path}.w:tbl[${index}]`
          })
        })
      } else {
        console.log(`  📋 Single table found`)
        tables.push({
          table: node['w:tbl'],
          path: `${path}.w:tbl`
        })
      }
    }
    
    // Recursively search all other properties
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== '$' && key !== 'w:tbl') {
        if (Array.isArray(node[key])) {
          node[key].forEach((item: any, index: number) => 
            this.findAllTablesInDocument(item, tables, `${path}.${key}[${index}]`)
          )
        } else {
          this.findAllTablesInDocument(node[key], tables, `${path}.${key}`)
        }
      }
    }
  }
  
  return tables
}

/**
 * Enhanced debug for document body to understand multi-table structure
 */
private async debugDocumentBody(body: any): Promise<void> {
  console.log('📄 Document body structure (multi-table debug):')
  console.log('📄 Body type:', typeof body)
  console.log('📄 Body is array:', Array.isArray(body))
  
  if (Array.isArray(body)) {
    console.log('📄 Body array length:', body.length)
    body.forEach((item, index) => {
      console.log(`📄 Body[${index}] keys:`, Object.keys(item || {}))
      if (item['w:tbl']) {
        console.log(`📄 Body[${index}] contains table`)
        this.debugTableStructure(item['w:tbl'], `Body[${index}].w:tbl`)
      }
    })
  } else {
    console.log('📄 Body keys:', Object.keys(body || {}))
    
    // Check how tables are structured in the body
    if (body['w:tbl']) {
      console.log('📄 Body contains w:tbl')
      this.debugTableStructure(body['w:tbl'], 'Body.w:tbl')
    }
    
    // Check for tables in other body elements
    for (const key in body) {
      if (body.hasOwnProperty(key) && key !== 'w:tbl') {
        if (Array.isArray(body[key])) {
          console.log(`📄 Body.${key} is array with ${body[key].length} items`)
          body[key].forEach((item: any, index: number) => {
            if (item && typeof item === 'object' && item['w:tbl']) {
              console.log(`📄 Found table in Body.${key}[${index}]`)
              this.debugTableStructure(item['w:tbl'], `Body.${key}[${index}].w:tbl`)
            }
          })
        }
      }
    }
  }
}

/**
 * Debug table structure to understand different formats
 */
private debugTableStructure(tableNode: any, path: string): void {
  console.log(`📋 Table structure at ${path}:`)
  
  if (Array.isArray(tableNode)) {
    console.log(`📋 Table node is array with ${tableNode.length} tables`)
    tableNode.forEach((table, index) => {
      console.log(`📋 Table[${index}] keys:`, Object.keys(table || {}))
      this.analyzeIndividualTable(table, `${path}[${index}]`)
    })
  } else {
    console.log(`📋 Table node is object`)
    console.log(`📋 Table keys:`, Object.keys(tableNode || {}))
    this.analyzeIndividualTable(tableNode, path)
  }
}

/**
 * Analyze individual table structure
 */
private analyzeIndividualTable(table: any, path: string): void {
  console.log(`📋 Analyzing table at ${path}:`)
  
  if (table['w:tr']) {
    console.log(`📋 ✅ Standard table with w:tr`)
    const rows = Array.isArray(table['w:tr']) ? table['w:tr'] : [table['w:tr']]
    console.log(`📋 Table has ${rows.length} rows`)
    
    // Check for array iteration in rows
    rows.forEach((row, index) => {
      const textNodes = this.findAllTextNodesInElement(row)
      const hasArrayIteration = textNodes.some(node => 
        /\{d\.[^[]+\[i\][^}]*\}/.test(node.text)
      )
      if (hasArrayIteration) {
        console.log(`📋 Row ${index} has array iteration tags`)
      }
    })
  } else if (Object.keys(table).every(key => /^\d+$/.test(key))) {
    console.log(`📋 ⚠️ Non-standard table with numeric keys: ${Object.keys(table)}`)
  } else {
    console.log(`📋 ❓ Unknown table structure with keys: ${Object.keys(table)}`)
  }
}



/**
 * Process standard table structure (w:tr array) - SAME AS BEFORE
 */
private async processStandardTable(table: any, data: any): Promise<boolean> {
  const rows = Array.isArray(table['w:tr']) ? table['w:tr'] : [table['w:tr']]
  console.log(`  📋 Standard table has ${rows.length} rows`)
  
  // Find rows that contain array iteration tags
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const arrayIterationInfo = this.findArrayIterationInRow(row)
    
    if (arrayIterationInfo) {
      console.log(`  🔄 Found array iteration in row ${rowIndex}: ${arrayIterationInfo.arrayPath}`)
      
      // Get the array data
      const arrayData = this.getArrayDataFromPath(arrayIterationInfo.arrayPath, data)
      console.log(`  📊 Array data length: ${arrayData.length}`)
      
      if (Array.isArray(arrayData) && arrayData.length > 0) {
        console.log(`  📊 Creating ${arrayData.length} rows for array data`)
        
        // Create multiple rows from this template row
        const newRows = []
        
        // Keep rows before this one
        for (let i = 0; i < rowIndex; i++) {
          newRows.push(rows[i])
        }
        
        // Create a row for each array item
        for (let itemIndex = 0; itemIndex < arrayData.length; itemIndex++) {
          const newRow = JSON.parse(JSON.stringify(row)) // Clone the row
          console.log(`  🔄 Processing item ${itemIndex}: ${JSON.stringify(arrayData[itemIndex])}`)
          
          // Process all text nodes in this row
          await this.processRowForItem(newRow, itemIndex, data)
          
          newRows.push(newRow)
        }
        
        // Keep rows after this one
        for (let i = rowIndex + 1; i < rows.length; i++) {
          newRows.push(rows[i])
        }
        
        // Replace the table rows
        table['w:tr'] = newRows
        console.log(`  ✅ Replaced table rows: ${rows.length} → ${newRows.length}`)
        
        return true // Successfully processed
      } else {
        console.log(`  ⚠️ No array data found for path: ${arrayIterationInfo.arrayPath}`)
      }
    }
  }
  
  return false // No array iteration found
}
/**
 * Process all tables in the document
 */
private async processAllTablesInDocument(rootNode: any, data: any): Promise<void> {
  console.log('📋 Processing all tables in document...')
  
  // Find all tables in the document
  const tables = this.findAllTables(rootNode)
  console.log(`📊 Found ${tables.length} tables in document`)
  
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const table = tables[tableIndex]
    console.log(`📋 Processing table ${tableIndex + 1}`)
    
    const wasProcessed = await this.processTableForRowIteration(table, data)
    if (wasProcessed) {
      console.log(`✅ Table ${tableIndex + 1} processed successfully with row iteration`)
    } else {
      console.log(`ℹ️ Table ${tableIndex + 1} has no array iteration`)
    }
  }
}

/**
 * Find all tables in the document
 */
private findAllTables(node: any, tables: any[] = [], path: string = ''): any[] {
  if (typeof node === 'object' && node !== null) {
    if (node['w:tbl']) {
      console.log(`  📋 Found table at path: ${path}`)
      tables.push(node['w:tbl'])
    }
    
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== '$') {
        if (Array.isArray(node[key])) {
          node[key].forEach((item: any, index: number) => 
            this.findAllTables(item, tables, `${path}.${key}[${index}]`)
          )
        } else {
          this.findAllTables(node[key], tables, `${path}.${key}`)
        }
      }
    }
  }
  
  return tables
}


/**
 * Process array-based table structure (numeric keys)
 */
private async processArrayBasedTable(table: any, data: any): Promise<boolean> {
  const arrayKeys = Object.keys(table).sort((a, b) => parseInt(a) - parseInt(b))
  console.log(`  📋 Array table has ${arrayKeys.length} rows`)
  
  // Find rows that contain array iteration tags
  for (const key of arrayKeys) {
    const row = table[key]
    const arrayIterationInfo = this.findArrayIterationInRow(row)
    
    if (arrayIterationInfo) {
      console.log(`  🔄 Found array iteration in row ${key}: ${arrayIterationInfo.arrayPath}`)
      
      // Get the array data
      const arrayData = this.getArrayDataFromPath(arrayIterationInfo.arrayPath, data)
      console.log(`  📊 Array data length: ${arrayData.length}`)
      
      if (Array.isArray(arrayData) && arrayData.length > 0) {
        console.log(`  📊 Creating ${arrayData.length} rows for array data`)
        
        // Remove the template row
        delete table[key]
        
        // Create new rows for each array item
        const startIndex = parseInt(key)
        for (let itemIndex = 0; itemIndex < arrayData.length; itemIndex++) {
          const newRowKey = (startIndex + itemIndex).toString()
          const newRow = JSON.parse(JSON.stringify(row)) // Clone the row
          
          console.log(`  🔄 Processing item ${itemIndex} into row ${newRowKey}`)
          await this.processRowForItem(newRow, itemIndex, data)
          
          table[newRowKey] = newRow
        }
        
        console.log(`  ✅ Created ${arrayData.length} rows from template`)
        return true
      }
    }
  }
  
  return false
}


/**
 * Find ALL text nodes with template tags
 */
private findAllTextNodesWithTemplateTags(node: any, textNodes: Array<{node: any, text: string, path: string}> = [], path: string = ''): Array<{node: any, text: string, path: string}> {
  if (typeof node === 'object' && node !== null) {
    if (node['w:t']) {
      const text = typeof node['w:t'] === 'string' ? node['w:t'] : node['w:t']._
      if (text && this.containsTemplateTags(text)) {
        textNodes.push({
          node: node,
          text: text,
          path: path
        })
      }
    }
    
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== '$') {
        if (Array.isArray(node[key])) {
          node[key].forEach((item: any, index: number) => 
            this.findAllTextNodesWithTemplateTags(item, textNodes, `${path}.${key}[${index}]`)
          )
        } else {
          this.findAllTextNodesWithTemplateTags(node[key], textNodes, `${path}.${key}`)
        }
      }
    }
  }
  
  return textNodes
}

/**
 * Debug an element structure recursively
 */
private debugElement(element: any, path: string, depth: number): void {
  if (depth > 3) return // Limit recursion depth
  
  const indent = '  '.repeat(depth)
  
  if (typeof element === 'object' && element !== null) {
    // Check for tables
    if (element['w:tbl']) {
      console.log(`${indent}📋 Found table at ${path}`)
      this.debugTable(element['w:tbl'], `${path}.w:tbl`, depth + 1)
    }
    
    // Check for paragraphs
    if (element['w:p']) {
      console.log(`${indent}📝 Found paragraph at ${path}`)
      if (Array.isArray(element['w:p'])) {
        element['w:p'].forEach((para, index) => {
          this.debugParagraph(para, `${path}.w:p[${index}]`, depth + 1)
        })
      } else {
        this.debugParagraph(element['w:p'], `${path}.w:p`, depth + 1)
      }
    }
    
    // Check for text runs
    if (element['w:r']) {
      console.log(`${indent}📝 Found text run at ${path}`)
      if (Array.isArray(element['w:r'])) {
        element['w:r'].forEach((run, index) => {
          this.debugTextRun(run, `${path}.w:r[${index}]`, depth + 1)
        })
      } else {
        this.debugTextRun(element['w:r'], `${path}.w:r`, depth + 1)
      }
    }
    
    // Check for text nodes
    if (element['w:t']) {
      const text = typeof element['w:t'] === 'string' ? element['w:t'] : element['w:t']._
      console.log(`${indent}📝 Found text at ${path}: "${text}"`)
    }
    
    // Recursively check other properties
    for (const key in element) {
      if (element.hasOwnProperty(key) && key !== '$' && 
          !['w:tbl', 'w:p', 'w:r', 'w:t'].includes(key)) {
        if (Array.isArray(element[key])) {
          element[key].forEach((item: any, index: number) => {
            this.debugElement(item, `${path}.${key}[${index}]`, depth + 1)
          })
        } else {
          this.debugElement(element[key], `${path}.${key}`, depth + 1)
        }
      }
    }
  }
}

/**
 * Debug table structure
 */
private debugTable(table: any, path: string, depth: number): void {
  const indent = '  '.repeat(depth)
  console.log(`${indent}📋 Table structure at ${path}:`)
  console.log(`${indent}📋 Table keys:`, Object.keys(table || {}))
  
  // Check for table rows
  if (table['w:tr']) {
    console.log(`${indent}📋 Found table rows (w:tr)`)
    if (Array.isArray(table['w:tr'])) {
      console.log(`${indent}📋 Table has ${table['w:tr'].length} rows`)
      table['w:tr'].forEach((row, index) => {
        console.log(`${indent}📋 Row ${index} keys:`, Object.keys(row || {}))
        this.debugTableRow(row, `${path}.w:tr[${index}]`, depth + 1)
      })
    } else {
      console.log(`${indent}📋 Table has 1 row`)
      this.debugTableRow(table['w:tr'], `${path}.w:tr`, depth + 1)
    }
  } else {
    console.log(`${indent}⚠️ No w:tr found in table`)
    console.log(`${indent}⚠️ Available keys:`, Object.keys(table))
    
    // Check for alternative table row structures
    for (const key in table) {
      if (key.includes('tr') || key.includes('row')) {
        console.log(`${indent}🔍 Found potential row key: ${key}`)
      }
    }
  }
}

/**
 * Debug table row structure
 */
private debugTableRow(row: any, path: string, depth: number): void {
  const indent = '  '.repeat(depth)
  console.log(`${indent}📋 Row structure at ${path}:`)
  console.log(`${indent}📋 Row keys:`, Object.keys(row || {}))
  
  // Check for table cells
  if (row['w:tc']) {
    console.log(`${indent}📋 Found table cells (w:tc)`)
    if (Array.isArray(row['w:tc'])) {
      console.log(`${indent}📋 Row has ${row['w:tc'].length} cells`)
      row['w:tc'].forEach((cell, index) => {
        console.log(`${indent}📋 Cell ${index} keys:`, Object.keys(cell || {}))
        this.debugTableCell(cell, `${path}.w:tc[${index}]`, depth + 1)
      })
    } else {
      console.log(`${indent}📋 Row has 1 cell`)
      this.debugTableCell(row['w:tc'], `${path}.w:tc`, depth + 1)
    }
  }
}

/**
 * Debug table cell structure
 */
private debugTableCell(cell: any, path: string, depth: number): void {
  const indent = '  '.repeat(depth)
  console.log(`${indent}📋 Cell structure at ${path}:`)
  
  // Look for text in the cell
  const textNodes = this.findAllTextNodesInElement(cell)
  console.log(`${indent}📋 Cell has ${textNodes.length} text nodes:`)
  textNodes.forEach((node, index) => {
    console.log(`${indent}📝 Text ${index}: "${node.text}"`)
  })
}

/**
 * Debug paragraph structure
 */
private debugParagraph(paragraph: any, path: string, depth: number): void {
  const indent = '  '.repeat(depth)
  const textNodes = this.findAllTextNodesInElement(paragraph)
  if (textNodes.length > 0) {
    console.log(`${indent}📝 Paragraph has ${textNodes.length} text nodes:`)
    textNodes.forEach((node, index) => {
      console.log(`${indent}📝 Text ${index}: "${node.text}"`)
    })
  }
}

/**
 * Debug text run structure
 */
private debugTextRun(run: any, path: string, depth: number): void {
  const indent = '  '.repeat(depth)
  const textNodes = this.findAllTextNodesInElement(run)
  if (textNodes.length > 0) {
    console.log(`${indent}📝 Text run has ${textNodes.length} text nodes:`)
    textNodes.forEach((node, index) => {
      console.log(`${indent}📝 Text ${index}: "${node.text}"`)
    })
  }
}

private async processBodyElementsSequentially(body: any, data: any): Promise<void> {
  console.log('📄 Processing document body elements sequentially...')
  
  // Handle both array and single element cases
  const elements = Array.isArray(body) ? body : [body]
  
  for (const element of elements) {
    await this.processElementsRecursively(element, data)
  }
}

/**
 * Process elements recursively, handling both text and tables
 */
private async processElementsRecursively(element: any, data: any): Promise<void> {
  if (typeof element === 'object' && element !== null) {
    // Handle tables
    if (element['w:tbl']) {
      console.log('📋 Found table, processing...')
      const wasProcessed = await this.processTableForRowIteration(element['w:tbl'], data)
      if (!wasProcessed) {
        console.log('📋 Table had no array iteration, processing text nodes normally')
        await this.processTextNodesInElement(element, data)
      }
    }
    // Handle paragraphs
    else if (element['w:p']) {
      await this.processTextNodesInElement(element, data)
    }
    // Handle other elements recursively
    else {
      for (const key in element) {
        if (element.hasOwnProperty(key) && key !== '$') {
          if (Array.isArray(element[key])) {
            for (const item of element[key]) {
              await this.processElementsRecursively(item, data)
            }
          } else {
            await this.processElementsRecursively(element[key], data)
          }
        }
      }
    }
  }
}



/**
 * Handle table row iterations specifically
 */
private async handleTableRowIterations(rootNode: any, data: any): Promise<void> {
  console.log('📋 Handling table row iterations...')
  
  // Find all tables in the document
  const tables = this.findAllTables(rootNode)
  console.log(`📊 Found ${tables.length} tables in document`)
  
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const table = tables[tableIndex]
    console.log(`📋 Processing table ${tableIndex + 1}`)
    
    const wasProcessed = await this.processTableForRowIteration(table, data)
    if (wasProcessed) {
      console.log(`✅ Table ${tableIndex + 1} processed successfully`)
    } else {
      console.log(`ℹ️ Table ${tableIndex + 1} has no array iteration`)
    }
  }
}



private findAllTextNodesInDocument(node: any, textNodes: Array<{node: any, text: string, path: string}> = [], path: string = ''): Array<{node: any, text: string, path: string}> {
  if (typeof node === 'object' && node !== null) {
    if (node['w:t']) {
      const text = typeof node['w:t'] === 'string' ? node['w:t'] : node['w:t']._
      if (text) {
        textNodes.push({
          node: node,
          text: text,
          path: path
        })
      }
    }
    
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== '$') {
        if (Array.isArray(node[key])) {
          node[key].forEach((item: any, index: number) => 
            this.findAllTextNodesInDocument(item, textNodes, `${path}.${key}[${index}]`)
          )
        } else {
          this.findAllTextNodesInDocument(node[key], textNodes, `${path}.${key}`)
        }
      }
    }
  }
  
  return textNodes
}




/**
 * Find tables that contain array iteration tags
 */
// private findTablesWithArrayIteration(node: any, tables: Array<{table: any, templateRow: any, arrayPath: string}> = []): Array<{table: any, templateRow: any, arrayPath: string}> {
//   if (typeof node === 'object' && node !== null) {
//     // Check if this is a table
//     if (node['w:tbl']) {
//       const table = node['w:tbl']
//       const templateRowInfo = this.findTemplateRowInTable(table)
      
//       if (templateRowInfo) {
//         tables.push({
//           table: table,
//           templateRow: templateRowInfo.row,
//           arrayPath: templateRowInfo.arrayPath
//         })
//       }
//     }
    
//     // Recursively search
//     for (const key in node) {
//       if (node.hasOwnProperty(key) && key !== '$') {
//         if (Array.isArray(node[key])) {
//           node[key].forEach((item: any) => this.findTablesWithArrayIteration(item, tables))
//         } else {
//           this.findTablesWithArrayIteration(node[key], tables)
//         }
//       }
//     }
//   }
  
//   return tables
// }

/**
 * Find the template row in a table that contains array iteration
 */
// private findTemplateRowInTable(table: any): {row: any, arrayPath: string} | null {
//   if (!table['w:tr']) return null
  
//   const rows = Array.isArray(table['w:tr']) ? table['w:tr'] : [table['w:tr']]
  
//   for (const row of rows) {
//     const arrayPath = this.findArrayIterationInRow(row)
//     if (arrayPath) {
//       return { row, arrayPath }
//     }
//   }
  
//   return null
// }

/**
 * Process table row iteration
 */
private async processTableRowIteration(tableInfo: {table: any, templateRow: any, arrayPath: string}, data: any): Promise<void> {
  console.log(`📋 Processing table row iteration for array: ${tableInfo.arrayPath}`)
  
  // Get the array data
  const arrayData = this.getArrayDataFromPath(tableInfo.arrayPath, data)
  if (!Array.isArray(arrayData) || arrayData.length === 0) {
    console.log('⚠️ No array data found or empty array')
    return
  }
  
  console.log(`📊 Found ${arrayData.length} items in array`)
  
  // Get all rows in the table
  const allRows = Array.isArray(tableInfo.table['w:tr']) ? tableInfo.table['w:tr'] : [tableInfo.table['w:tr']]
  const templateRowIndex = allRows.indexOf(tableInfo.templateRow)
  
  if (templateRowIndex === -1) {
    console.log('⚠️ Template row not found in table')
    return
  }
  
  // Create new rows for each array item
  const newRows: any[] = []
  
  // Keep rows before template row
  for (let i = 0; i < templateRowIndex; i++) {
    newRows.push(allRows[i])
  }
  
  // Create a row for each array item
  for (let itemIndex = 0; itemIndex < arrayData.length; itemIndex++) {
    const item = arrayData[itemIndex]
    console.log(`📝 Creating row ${itemIndex + 1} for item:`, item)
    
    // Clone the template row
    const newRow = JSON.parse(JSON.stringify(tableInfo.templateRow))
    
    // Process all text nodes in this row
    const textNodes = this.findAllTextNodesInElement(newRow)
    
    for (const textNodeInfo of textNodes) {
      const originalText = textNodeInfo.text
      
      // Replace [i] with the actual index for this iteration
      const textWithIndex = originalText.replace(/\[i\]/g, `[${itemIndex}]`)
      
      // Process the text with template engine
      try {
        const processedResult = await this.render({
          template: {
            content: textWithIndex,
            format: DocumentFormat.TXT
          },
          data: data
        })
        
        const processedText = processedResult.content.toString()
        this.replaceTextInNode(textNodeInfo.node, processedText)
        
        console.log(`  ✅ "${originalText}" → "${processedText}"`)
      } catch (error) {
        console.log(`  ❌ Error processing "${originalText}":`, error)
      }
    }
    
    newRows.push(newRow)
  }
  
  // Keep rows after template row
  for (let i = templateRowIndex + 1; i < allRows.length; i++) {
    newRows.push(allRows[i])
  }
  
  // Replace the table rows
  tableInfo.table['w:tr'] = newRows
  
  console.log(`✅ Table processing complete. Created ${arrayData.length} rows from template.`)
}


/**
 * Find text nodes with template tags (excluding table content already processed)
 */
private findTextNodesWithTemplateTags(node: any, textNodes: Array<{node: any, text: string, path: string}> = [], path: string = '', inTable: boolean = false): Array<{node: any, text: string, path: string}> {
  if (typeof node === 'object' && node !== null) {
    // Check if we're entering a table
    const currentlyInTable = inTable || !!node['w:tbl']
    
    // Check if this is a text node
    if (node['w:t'] && !currentlyInTable) {
      const text = typeof node['w:t'] === 'string' ? node['w:t'] : node['w:t']._
      if (text && this.containsTemplateTags(text)) {
        textNodes.push({
          node: node,
          text: text,
          path: path
        })
      }
    }
    
    // Recursively search all properties
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== '$') {
        if (Array.isArray(node[key])) {
          node[key].forEach((item: any, index: number) => 
            this.findTextNodesWithTemplateTags(item, textNodes, `${path}.${key}[${index}]`, currentlyInTable)
          )
        } else {
          this.findTextNodesWithTemplateTags(node[key], textNodes, `${path}.${key}`, currentlyInTable)
        }
      }
    }
  }
  
  return textNodes
}


  /**
   * Extract text content from parsed DOCX document
   */
  private async extractTextFromDocx(parsedDoc: ParsedDocument): Promise<string> {
  if (typeof parsedDoc.content === 'string') {
    return parsedDoc.content
  }

  const structure = parsedDoc.content as DocumentStructure
  if (!structure.root) {
    throw new Error('Invalid DOCX structure')
  }

  console.log('🔍 Starting DOCX text extraction...')
  
  // Debug: Find all text nodes and their paths
  const textNodesWithPaths = this.findAllTextNodesWithPaths(structure.root)
  console.log('📝 All text nodes found:', textNodesWithPaths)
  
  // Extract unique text content
  const uniqueTextNodes = [...new Set(textNodesWithPaths.map(node => node.text))]
  console.log('📝 Unique text nodes:', uniqueTextNodes)
  
  const extractedText = uniqueTextNodes.join('')
  console.log('📝 Final extracted text:', extractedText)
  
  return extractedText
}

/**
 * Find all text nodes with their paths for debugging
 */
private findAllTextNodesWithPaths(node: any, path: string = '', textNodes: Array<{text: string, path: string}> = []): Array<{text: string, path: string}> {
  if (typeof node === 'string') {
    return textNodes
  }

  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      this.findAllTextNodesWithPaths(item, `${path}[${index}]`, textNodes)
    })
    return textNodes
  }

  if (typeof node === 'object' && node !== null) {
    // If this is a text node, add it to our collection
    if (node['w:t']) {
      const textContent = node['w:t']
      let text = ''
      if (typeof textContent === 'string') {
        text = textContent
      } else if (textContent._ && typeof textContent._ === 'string') {
        text = textContent._
      }
      
      if (text) {
        textNodes.push({ text, path: `${path}.w:t` })
      }
    }
    
    // Recursively search all properties
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== '$') {
        this.findAllTextNodesWithPaths(node[key], `${path}.${key}`, textNodes)
      }
    }
  }

  return textNodes
}

  /**
   * Recursively extract text content from XML nodes
   */
  private extractTextFromXmlNode(node: any, visited: Set<any> = new Set()): string {
  // Avoid processing the same node multiple times
  if (visited.has(node)) {
    return ''
  }
  visited.add(node)

  if (typeof node === 'string') {
    return node
  }

  if (Array.isArray(node)) {
    return node.map(item => this.extractTextFromXmlNode(item, visited)).join('')
  }

  if (typeof node === 'object' && node !== null) {
    // ONLY process text nodes (w:t) - ignore all other content
    if (node['w:t']) {
      const textContent = node['w:t']
      if (typeof textContent === 'string') {
        return textContent
      } else if (textContent._ && typeof textContent._ === 'string') {
        return textContent._
      }
    }
    
    // For non-text nodes, only process specific structural elements
    let text = ''
    
    // Process document body
    if (node['w:document'] && node['w:document']['w:body']) {
      return this.extractTextFromXmlNode(node['w:document']['w:body'], visited)
    }
    
    // Process paragraphs
    if (node['w:p']) {
      const paragraphText = this.extractTextFromXmlNode(node['w:p'], visited)
      return paragraphText + '\n'
    }
    
    // Process runs
    if (node['w:r']) {
      return this.extractTextFromXmlNode(node['w:r'], visited)
    }
    
    // For arrays of paragraphs/runs
    if (Array.isArray(node)) {
      return node.map(item => this.extractTextFromXmlNode(item, visited)).join('')
    }
    
    // For other structural elements, process children but avoid duplication
    const structuralKeys = ['w:body', 'w:p', 'w:r']
    for (const key of structuralKeys) {
      if (node[key]) {
        const childText = this.extractTextFromXmlNode(node[key], visited)
        if (childText && !text.includes(childText)) {
          text += childText
        }
      }
    }
    
    return text
  }

  return ''
}

  /**
   * Reconstruct DOCX document with processed content
   */
  private async reconstructDocx(originalDoc: ParsedDocument, processedText: string, data: any): Promise<RenderedDocument> {
  try {
    const structure = originalDoc.content as DocumentStructure
    const newStructure = JSON.parse(JSON.stringify(structure))
    
    console.log('🎨 Enhanced formatting preservation...')
    
    // Get all text nodes with their positions and formatting
    const textNodes = this.getAllTextNodesWithFormatting(newStructure.root)
    console.log('📝 Found text nodes with formatting:', textNodes.length)
    
    // Process the text and map it back to the formatted nodes
    this.mapProcessedTextToFormattedNodes(textNodes, processedText)
    
    // Create processed data
    const processedData: ProcessedData = {
      main: data,
      complement: {},
      computed: new Map(),
      aggregations: new Map(),
      metadata: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        dataSize: JSON.stringify(data).length,
        tagCount: 0,
        errors: [],
        warnings: []
      }
    }
    
    // Render with DOCX handler
    const docxHandler = this.formatRegistry.getHandler(DocumentFormat.DOCX)
    if (!docxHandler) {
      throw new Error('DOCX handler not available')
    }
    
    const newParsedDoc: ParsedDocument = {
      format: DocumentFormat.DOCX,
      content: newStructure,
      metadata: originalDoc.metadata,
      assets: originalDoc.assets
    }
    
    return await docxHandler.render(newParsedDoc, processedData)
  } catch (error) {
    throw new Error(`Failed to reconstruct DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

private getAllTextNodesWithFormatting(node: any, textNodes: Array<{node: any, text: string, path: string}> = [], path: string = ''): Array<{node: any, text: string, path: string}> {
  if (typeof node === 'object' && node !== null) {
    if (node['w:t']) {
      const text = typeof node['w:t'] === 'string' ? node['w:t'] : node['w:t']._
      if (text) {
        textNodes.push({
          node: node,
          text: text,
          path: path
        })
      }
    }
    
    // Recursively search
    for (const key in node) {
      if (node.hasOwnProperty(key) && key !== '$') {
        if (Array.isArray(node[key])) {
          node[key].forEach((item: any, index: number) => 
            this.getAllTextNodesWithFormatting(item, textNodes, `${path}.${key}[${index}]`)
          )
        } else {
          this.getAllTextNodesWithFormatting(node[key], textNodes, `${path}.${key}`)
        }
      }
    }
  }
  
  return textNodes
}

private mapProcessedTextToFormattedNodes(textNodes: Array<{node: any, text: string, path: string}>, processedText: string): void {
  // Reconstruct the original text
  const originalText = textNodes.map(node => node.text).join('')
  console.log('📝 Original text:', originalText)
  console.log('📝 Processed text:', processedText)
  
  if (textNodes.length === 1) {
    // Simple case: single text node
    const textNode = textNodes[0]
    console.log(`🔄 Replacing single text node: "${textNode.text}" → "${processedText}"`)
    
    if (typeof textNode.node['w:t'] === 'string') {
      textNode.node['w:t'] = processedText
    } else if (textNode.node['w:t']._) {
      textNode.node['w:t']._ = processedText
    }
  } else if (textNodes.length === 2) {
    // Two text nodes case (like "Hello" and " {d.name}!")
    const firstNode = textNodes[0]
    const secondNode = textNodes[1]
    
    // Find where the first part ends and second begins in the processed text
    const firstText = firstNode.text
    const processedFirstPart = processedText.substring(0, firstText.length)
    const processedSecondPart = processedText.substring(firstText.length)
    
    console.log(`🔄 Replacing first node: "${firstNode.text}" → "${processedFirstPart}"`)
    console.log(`🔄 Replacing second node: "${secondNode.text}" → "${processedSecondPart}"`)
    
    // Update first node
    if (typeof firstNode.node['w:t'] === 'string') {
      firstNode.node['w:t'] = processedFirstPart
    } else if (firstNode.node['w:t']._) {
      firstNode.node['w:t']._ = processedFirstPart
    }
    
    // Update second node
    if (typeof secondNode.node['w:t'] === 'string') {
      secondNode.node['w:t'] = processedSecondPart
    } else if (secondNode.node['w:t']._) {
      secondNode.node['w:t']._ = processedSecondPart
    }
  } else {
    // Multiple nodes - distribute the processed text proportionally
    console.log(`🔄 Handling ${textNodes.length} text nodes`)
    
    // For now, put all processed text in the first node and clear others
    // (This preserves the formatting of the first node)
    if (textNodes.length > 0) {
      const firstNode = textNodes[0]
      
      if (typeof firstNode.node['w:t'] === 'string') {
        firstNode.node['w:t'] = processedText
      } else if (firstNode.node['w:t']._) {
        firstNode.node['w:t']._ = processedText
      }
      
      // Clear other nodes to avoid duplication
      for (let i = 1; i < textNodes.length; i++) {
        const node = textNodes[i]
        if (typeof node.node['w:t'] === 'string') {
          node.node['w:t'] = ''
        } else if (node.node['w:t']._) {
          node.node['w:t']._ = ''
        }
      }
    }
  }
}

/**
 * Replace text content in the document structure systematically
 */
private replaceTextContentInStructure(root: any, newText: string): void {
  console.log('🔄 Replacing text content with:', newText)
  
  // Find the document body
  if (root['w:document'] && root['w:document']['w:body']) {
    const body = root['w:document']['w:body']
    
    // Process each paragraph in the body
    if (body['w:p']) {
      const paragraphs = Array.isArray(body['w:p']) ? body['w:p'] : [body['w:p']]
      
      // Clear all existing text and replace with new content
      paragraphs.forEach((paragraph: any, index: number) => {
        if (index === 0) {
          // Replace content in first paragraph
          this.replaceTextInParagraph(paragraph, newText)
        } else {
          // Remove other paragraphs to avoid duplication
          // (or you could keep them for formatting)
        }
      })
      
      // Ensure we only have one paragraph with the processed text
      body['w:p'] = paragraphs[0]
    }
  }
}

/**
 * Replace text in a specific paragraph
 */
private replaceTextInParagraph(paragraph: any, newText: string): void {
  if (paragraph['w:r']) {
    const runs = Array.isArray(paragraph['w:r']) ? paragraph['w:r'] : [paragraph['w:r']]
    
    // Clear all runs and create a single run with the new text
    const firstRun = runs[0] || {}
    
    // Keep formatting but replace text
    firstRun['w:t'] = newText
    
    // Set this as the only run
    paragraph['w:r'] = firstRun
  } else {
    // Create a new run with the text
    paragraph['w:r'] = {
      'w:t': newText
    }
  }
}

  /**
   * Replace text content in XML nodes
   */
  private replaceTextInXmlNode(node: any, newText: string): void {
    if (typeof node === 'object' && node !== null) {
      if (node['w:t']) {
        // Replace text content
        if (typeof node['w:t'] === 'string') {
          node['w:t'] = newText
        } else if (node['w:t']._) {
          node['w:t']._ = newText
        }
        return // Don't process further once we've replaced text
      }
      
      // Recursively process all properties
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          if (Array.isArray(node[key])) {
            node[key].forEach((item: any) => this.replaceTextInXmlNode(item, newText))
          } else {
            this.replaceTextInXmlNode(node[key], newText)
          }
        }
      }
    }
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
