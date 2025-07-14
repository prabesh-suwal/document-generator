
export enum DocumentFormat {
  DOCX = 'docx',
  XLSX = 'xlsx',
  PPTX = 'pptx',
  ODT = 'odt',
  ODS = 'ods',
  ODP = 'odp',
  HTML = 'html',
  PDF = 'pdf',
  TXT = 'txt',
  CSV = 'csv',
  XML = 'xml',
  MARKDOWN = 'md',
  RTF = 'rtf'
}


export enum TagType {
  DATA = 'data',           // {d.property}
  COMPLEMENT = 'complement', // {c.property}
  TRANSLATION = 'translation', // {t(key)}
  ALIAS = 'alias',         // {# alias}
  OPTION = 'option'        // {o.option}
}

export interface TagInfo {
  id: string
  type: TagType
  path: string
  formatters: FormatterCall[]
  position: number
  raw: string
  arrayPath?: ArrayPath
}

export interface ArrayPath {
  basePath: string
  index?: string | number
  filter?: FilterCondition
}

export interface FilterCondition {
  property: string
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'
  value: any
}

export interface FormatterCall {
  name: string
  parameters: FormatterParameter[]
}

export interface FormatterParameter {
  type: 'constant' | 'dynamic'
  value: any
  path?: string
}

export interface ParsedTemplate {
  id: string
  format: DocumentFormat
  content: string
  tags: TagInfo[]
  dependencies: DependencyGraph
  structure: DocumentStructure
  metadata: TemplateMetadata
}

export interface DependencyGraph {
  nodes: DependencyNode[]
  edges: DependencyEdge[]
  sortedTags: TagInfo[]
}

export interface DependencyNode {
  tagId: string
  dependencies: string[]
  dependents: string[]
}

export interface DependencyEdge {
  from: string
  to: string
  type: 'data' | 'computation'
}

export interface DocumentStructure {
  elements: DocumentElement[]
  relationships: ElementRelationship[]
}

export interface DocumentElement {
  id: string
  type: 'text' | 'table' | 'image' | 'list' | 'header' | 'footer'
  position: ElementPosition
  content: string
  tags: string[]
}

export interface ElementPosition {
  start: number
  end: number
  line?: number
  column?: number
}

export interface ElementRelationship {
  parent: string
  child: string
  type: 'contains' | 'follows' | 'references'
}

export interface TemplateMetadata {
  name?: string
  version?: string
  author?: string
  created: Date
  modified: Date
  tags: string[]
  description?: string
}

export interface ProcessedData {
  main: any
  complement?: any
  computed: Map<string, any>
  aggregations: Map<string, any>
  metadata: ProcessingMetadata
}


export interface ProcessingMetadata {
  startTime: Date
  endTime: Date
  duration: number
  dataSize: number
  tagCount: number
  errors: ProcessingError[]
  warnings: ProcessingWarning[]
}

export interface ProcessingError {
  code: string
  message: string
  tagId?: string
  path?: string
  context?: any
}

export interface ProcessingWarning {
  code: string
  message: string
  severity: 'warning' | 'info'
  tagId?: string
  path?: string
  context?: any
}


export interface RenderedDocument {
  content: Buffer
  format: DocumentFormat
  metadata: RenderMetadata
  warnings: ProcessingWarning[]
}

export interface RenderMetadata {
  templateId: string
  renderTime: Date
  duration: number
  outputSize: number
  fromCache?: boolean
  cacheHit?: boolean
  conversionApplied?: boolean    // Add this
  linesGenerated?: number        // Add this
}

export interface RenderRequest {
  template: TemplateInput
  data: any
  options?: RenderOptions
}

export interface TemplateInput {
  content?: Buffer | string
  templateId?: string
  format?: DocumentFormat
}

export interface RenderOptions {
  convertTo?: DocumentFormat
  locale?: string
  complement?: any
  translations?: TranslationDictionary
  cache?: CacheOptions
  timeout?: number
}

export interface TranslationDictionary {
  [locale: string]: {
    [key: string]: string
  }
}

export interface CacheOptions {
  useTemplateCache?: boolean
  useRenderCache?: boolean
  ttl?: number
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions?: string[]
}

export interface ValidationError {
  code: string
  message: string
  severity: 'error' | 'warning'
  location?: ErrorLocation
  context?: any
}

export interface ValidationWarning {
  code: string
  message: string
  location?: ErrorLocation
}

export interface ErrorLocation {
  line: number
  column: number
  position: number
  tag?: string
}

export interface EngineConfig {
  performance: PerformanceConfig
  formats: FormatConfig
  security: SecurityConfig
  storage: StorageConfig
  logging: LoggingConfig
}

export interface PerformanceConfig {
  workerPools: {
    render: PoolConfig
    conversion: PoolConfig
  }
  caching: {
    templates: CacheConfig
    renders: CacheConfig
    conversions: CacheConfig
  }
  limits: {
    maxTemplateSize: number
    maxDataSize: number
    maxRenderTime: number
  }
}

export interface PoolConfig {
  min: number
  max: number
  idleTimeoutMs: number
}

export interface CacheConfig {
  enabled: boolean
  maxSize: number
  ttlMs: number
  type: 'memory' | 'redis'
}

export interface FormatConfig {
  input: DocumentFormat[]
  output: DocumentFormat[]
  defaultInput: DocumentFormat
  defaultOutput: DocumentFormat
}

export interface SecurityConfig {
  sandbox: boolean
  allowedTags: string[]
  maxNestingDepth: number
  allowExternalResources: boolean
}

export interface StorageConfig {
  templatesPath: string
  cachePath: string
  outputPath: string
  tempPath: string
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  format: 'json' | 'simple'
  outputs: string[]
}

// Error types
export class TemplateEngineError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any
  ) {
    super(message)
    this.name = 'TemplateEngineError'
  }
}

export class TemplateParseError extends TemplateEngineError {
  constructor(message: string, context?: any) {
    super(message, 'TEMPLATE_PARSE_ERROR', context)
    this.name = 'TemplateParseError'
  }
}

// Data processing error class
export class DataProcessingError extends Error {
  public code: string
  public context?: any

  constructor(message: string, context?: any) {
    super(message)
    this.name = 'DataProcessingError'
    this.code = 'DATA_PROCESSING_ERROR'
    this.context = context
  }
}

export class RenderError extends TemplateEngineError {
  constructor(message: string, context?: any) {
    super(message, 'RENDER_ERROR', context)
    this.name = 'RenderError'
  }
}

export class ConversionError extends TemplateEngineError {
  constructor(message: string, context?: any) {
    super(message, 'CONVERSION_ERROR', context)
    this.name = 'ConversionError'
  }
}

export class ValidationError extends TemplateEngineError {
  constructor(message: string, context?: any) {
    super(message, 'VALIDATION_ERROR', context)
    this.name = 'ValidationError'
  }
}

export interface FormatterContext {
  currentData: any
  rootData: any
  locale?: string
  timezone?: string
}



// Document-specific types (add these to core.ts for now)
export interface TextNodeInfo {
  text: string
  line: number
  elementPath: string[]
  nodeRef: any
}


export interface ArrayRegion {
  startLine: number
  endLine: number
  arrayPath: string
  elementPath: string[]
}

export interface FormattingInfo {
  type: string
  styles: any
  position: number
}

export interface DocumentStructureMap {
  textNodes: TextNodeInfo[]
  arrayRegions: ArrayRegion[]
  formatting: FormattingInfo[]
}