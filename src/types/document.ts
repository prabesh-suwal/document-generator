import { ArrayRegion, DocumentFormat, FormattingInfo, ProcessedData, RenderedDocument, TextNodeInfo } from "./core"

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
  assets?: Map<string, Buffer>
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

export interface ContentExtractionResult {
  templateContent: string
  tagMappings: Map<string, TagPosition>
  structureMap: DocumentStructureMap
}

export interface TagPosition {
  line: number
  column: number
  context: string
  elementPath: string[]
}

export interface DocumentStructureMap {
  textNodes: TextNodeInfo[]
  arrayRegions: ArrayRegion[]
  formatting: FormattingInfo[]
}