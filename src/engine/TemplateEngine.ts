import { 
  RenderRequest, 
  RenderedDocument, 
  ValidationResult,
  DocumentFormat,
  EngineConfig,
  TemplateInput,
  ParsedTemplate,
  TagInfo
} from '../types/core'
import { TemplateParser } from '../parser/TemplateParser'
import { DataProcessor } from '../processor/DataProcessor'
import { RendererEngine } from '../renderer/RendererEngine'
import { FormatterRegistry } from '../formatters/FormatterRegistry'
import { 
  UpperCaseFormatter, 
  LowerCaseFormatter, 
  UcFirstFormatter,
  TrimFormatter,
  SubstrFormatter,
  ReplaceFormatter,
  RoundFormatter,
  AddFormatter,
  MultiplyFormatter,
  EqualsFormatter,
  IfTrueFormatter
} from '../formatters/index'
import { 
  AggSumFormatter,
  AggAvgFormatter,
  AggCountFormatter,
  AggMinFormatter,
  AggMaxFormatter
} from '../formatters/aggregation/AggregationFormatters'

export class TemplateEngine {
  private parser: TemplateParser
  private processor: DataProcessor
  private renderer: RendererEngine
  private formatterRegistry: FormatterRegistry
  private config: EngineConfig

  private memoryCache: Map<string, { data: RenderedDocument; timestamp: number; ttl: number }> = new Map()
  private readonly DEFAULT_CACHE_TTL = 3600000 // 1 hour in milliseconds


  constructor(config?: Partial<EngineConfig>) {
    this.config = this.mergeWithDefaultConfig(config)
    this.formatterRegistry = new FormatterRegistry()
    this.parser = new TemplateParser()
    this.processor = new DataProcessor()
    this.renderer = new RendererEngine(this.formatterRegistry)
    
    this.registerDefaultFormatters()
  }

  /**
   * Main render method with enhanced array iteration support
   */
  public async render(request: RenderRequest): Promise<RenderedDocument> {
    try {
      // Parse template
      const template = await this.parseTemplate(request.template)
      
      // Validate template
      const validation = this.validateTemplate(template)
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
      }

      // Process data with enhanced processor (handles array operations)
      const processedData = this.processor.process(request.data, template, request.options?.complement)
      
      // Render document with enhanced renderer (handles array iteration)
      const rendered = this.renderer.render(template, processedData)
      
      return rendered
    } catch (error) {
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse template with support for various input formats
   */
  public async parseTemplate(input: TemplateInput): Promise<ParsedTemplate> {
    let content: string
    let format: DocumentFormat

    if (input.content) {
      content = typeof input.content === 'string' 
        ? input.content 
        : input.content.toString('utf-8')
      format = input.format || DocumentFormat.TXT
    } else if (input.templateId) {
      // Load from template storage (if implemented)
      throw new Error('Template loading by ID not yet implemented')
    } else {
      throw new Error('Template content or templateId must be provided')
    }

    return this.parser.parse(content, format)
  }

  /**
   * Validate template with comprehensive checks
   */
  public validateTemplate(template: ParsedTemplate): ValidationResult {
    const errors: any[] = []
    const warnings: any[] = []

    // Validate formatter chains
    for (const tag of template.tags) {
      const chainValidation = this.formatterRegistry.validateChain(tag.formatters)
      errors.push(...chainValidation.errors)
      warnings.push(...chainValidation.warnings)
      
      // Additional validations
      this.validateTagStructure(tag, errors, warnings)
    }

    // Validate array operations
    this.validateArrayOperations(template.tags, errors, warnings)

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate individual tag structure
   */
  private validateTagStructure(tag: any, errors: any[], warnings: any[]): void {
    // Check for missing properties
    if (!tag.path) {
      errors.push({
        code: 'MISSING_PATH',
        message: `Tag ${tag.raw} is missing a valid path`,
        severity: 'error'
      })
    }

    // Check for proper array notation
    if (tag.arrayPath) {
      if (tag.arrayPath.index === 'i' && !tag.path.includes('[i]')) {
        warnings.push({
          code: 'INCONSISTENT_ARRAY_NOTATION',
          message: `Tag ${tag.raw} has array path but path doesn't contain [i]`,
          severity: 'warning'
        })
      }
    }

    // Check for formatter compatibility
    const hasArrayFormatters = tag.formatters.some((f: any) => 
      ['aggSum', 'aggAvg', 'aggCount', 'aggMin', 'aggMax'].includes(f.name)
    )
    const hasArrayPath = tag.arrayPath && tag.arrayPath.index === ''

    if (hasArrayFormatters && !hasArrayPath) {
      warnings.push({
        code: 'AGGREGATION_WITHOUT_ARRAY',
        message: `Tag ${tag.raw} uses aggregation formatters but is not an array aggregation`,
        severity: 'warning'
      })
    }
  }

  /**
   * Validate array operations across all tags
   */
  private validateArrayOperations(tags: any[], errors: any[], warnings: any[]): void {
    const arrayPaths = new Set<string>()
    const arrayIterationTags: any[] = []
    const arrayAggregationTags: any[] = []

    // Categorize array tags
    for (const tag of tags) {
      if (tag.arrayPath) {
        arrayPaths.add(tag.arrayPath.basePath)
        
        if (tag.arrayPath.index === 'i') {
          arrayIterationTags.push(tag)
        } else if (tag.arrayPath.index === '') {
          arrayAggregationTags.push(tag)
        }
      }
    }

    // Validate that array iterations and aggregations use consistent paths
    const iterationPaths = new Set(arrayIterationTags.map(tag => tag.arrayPath.basePath))
    const aggregationPaths = new Set(arrayAggregationTags.map(tag => tag.arrayPath.basePath))

    for (const aggPath of aggregationPaths) {
      if (!iterationPaths.has(aggPath)) {
        warnings.push({
          code: 'AGGREGATION_WITHOUT_ITERATION',
          message: `Array aggregation found for ${aggPath} but no iteration tags found`,
          severity: 'warning'
        })
      }
    }
  }

  /**
   * Get formatter registry for external use
   */
  public getFormatterRegistry(): FormatterRegistry {
    return this.formatterRegistry
  }

  /**
   * Register a custom formatter
   */
  public registerFormatter(formatter: any): void {
    this.formatterRegistry.register(formatter)
  }

  /**
   * Register multiple custom formatters
   */
  public registerFormatters(formatters: any[]): void {
    this.formatterRegistry.registerMultiple(formatters)
  }

  /**
   * Get template performance metrics
   */
  public async getPerformanceMetrics(template: ParsedTemplate, data: any): Promise<any> {
    const startTime = performance.now()
    
    const processedData = this.processor.process(data, template)
    const processingTime = performance.now() - startTime
    
    const renderStartTime = performance.now()
    const rendered = this.renderer.render(template, processedData)
    const renderingTime = performance.now() - renderStartTime
    
    return {
      parsing: {
        tagCount: template.tags.length,
        complexityScore: this.calculateComplexityScore(template)
      },
      processing: {
        duration: processingTime,
        dataSize: processedData.metadata.dataSize,
        arrayOperations: template.tags.filter(t => t.arrayPath).length
      },
      rendering: {
        duration: renderingTime,
        outputSize: rendered.content.length,
        linesGenerated: rendered.content.toString().split('\n').length
      },
      total: {
        duration: processingTime + renderingTime,
        efficiency: this.calculateEfficiency(template, processingTime + renderingTime)
      }
    }
  }

  /**
   * Calculate processing efficiency (tags per millisecond)
   */
  private calculateEfficiency(template: ParsedTemplate, duration: number): number {
    if (duration === 0) return Infinity
    return template.tags.length / duration
  }

  /**
   * Calculate template complexity score
   */
  private calculateComplexityScore(template: ParsedTemplate): number {
    let score = 0
    
    for (const tag of template.tags) {
      score += 1 // Base score per tag
      score += tag.formatters.length * 2 // Formatter complexity
      
      if (tag.arrayPath) {
        if (tag.arrayPath.index === 'i') {
          score += 5 // Array iteration is complex
        } else if (tag.arrayPath.index === '') {
          score += 3 // Array aggregation is moderately complex
        }
      }
      
      if (tag.formatters.some((f: any) => f.parameters.some((p: any) => p.type === 'dynamic'))) {
        score += 3 // Dynamic parameters add complexity
      }
    }
    
    return score
  }

/**
   * Debug method to analyze template structure
   */
  public analyzeTemplate(template: ParsedTemplate): any {
    const analysis = {
      summary: {
        totalTags: template.tags.length,
        arrayIterations: 0,
        arrayAggregations: 0,
        formatterUsage: new Map<string, number>(),
        complexityScore: this.calculateComplexityScore(template)
      },
      tags: {
        simple: [] as TagInfo[],
        arrayIteration: [] as TagInfo[],
        arrayAggregation: [] as TagInfo[],
        withFormatters: [] as TagInfo[]
      },
      arrays: {
        paths: new Set<string>(),
        operations: [] as Array<{
          type: string
          path: string
          tag: string
        }>
      },
      recommendations: [] as string[]
    }

    // Analyze each tag
    for (const tag of template.tags) {
      if (tag.arrayPath) {
        analysis.arrays.paths.add(tag.arrayPath.basePath)
        
        if (tag.arrayPath.index === 'i') {
          analysis.summary.arrayIterations++
          analysis.tags.arrayIteration.push(tag)
          analysis.arrays.operations.push({
            type: 'iteration',
            path: tag.arrayPath.basePath,
            tag: tag.raw
          })
        } else if (tag.arrayPath.index === '') {
          analysis.summary.arrayAggregations++
          analysis.tags.arrayAggregation.push(tag)
          analysis.arrays.operations.push({
            type: 'aggregation',
            path: tag.arrayPath.basePath,
            tag: tag.raw
          })
        }
      } else {
        analysis.tags.simple.push(tag)
      }

      if (tag.formatters.length > 0) {
        analysis.tags.withFormatters.push(tag)
        
        for (const formatter of tag.formatters) {
          const count = analysis.summary.formatterUsage.get(formatter.name) || 0
          analysis.summary.formatterUsage.set(formatter.name, count + 1)
        }
      }
    }

    // Generate recommendations
    if (analysis.summary.complexityScore > 50) {
      analysis.recommendations.push('Consider simplifying template - high complexity score')
    }

    if (analysis.summary.arrayIterations > 5) {
      analysis.recommendations.push('Multiple array iterations may impact performance')
    }

    if (analysis.summary.formatterUsage.size > 10) {
      analysis.recommendations.push('Many different formatters used - consider consolidating')
    }

    return analysis
  }


  /**
   * Register default formatters
   */
  private registerDefaultFormatters(): void {
    const formatters = [
      new UpperCaseFormatter(),
      new LowerCaseFormatter(),
      new UcFirstFormatter(),
      new TrimFormatter(),
      new SubstrFormatter(),
      new ReplaceFormatter(),
      new RoundFormatter(),
      new AddFormatter(),
      new MultiplyFormatter(),
      new EqualsFormatter(),
      new IfTrueFormatter(),
      new AggSumFormatter(),
      new AggAvgFormatter(),
      new AggCountFormatter(),
      new AggMinFormatter(),
      new AggMaxFormatter()
    ]

    this.formatterRegistry.registerMultiple(formatters)
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaultConfig(config?: Partial<EngineConfig>): EngineConfig {
    const defaultConfig: EngineConfig = {
      performance: {
        workerPools: {
          render: { min: 1, max: 4, idleTimeoutMs: 30000 },
          conversion: { min: 1, max: 2, idleTimeoutMs: 60000 }
        },
        caching: {
          templates: { enabled: true, maxSize: 100, ttlMs: 3600000, type: 'memory' },
          renders: { enabled: true, maxSize: 1000, ttlMs: 1800000, type: 'memory' },
          conversions: { enabled: true, maxSize: 500, ttlMs: 3600000, type: 'memory' }
        },
        limits: {
          maxTemplateSize: 10 * 1024 * 1024, // 10MB
          maxDataSize: 100 * 1024 * 1024,    // 100MB
          maxRenderTime: 30000                // 30 seconds
        }
      },
      formats: {
        input: [DocumentFormat.DOCX, DocumentFormat.HTML, DocumentFormat.TXT],
        output: [DocumentFormat.DOCX, DocumentFormat.HTML, DocumentFormat.PDF, DocumentFormat.TXT],
        defaultInput: DocumentFormat.TXT,
        defaultOutput: DocumentFormat.TXT
      },
      security: {
        sandbox: true,
        allowedTags: ['d', 'c', 't', 'o'],
        maxNestingDepth: 10,
        allowExternalResources: false
      },
      storage: {
        templatesPath: './templates',
        cachePath: './cache',
        outputPath: './output',
        tempPath: './temp'
      },
      logging: {
        level: 'info',
        format: 'simple',
        outputs: ['console']
      }
    }

    return { ...defaultConfig, ...config } as EngineConfig
  }

  /**
   * Shutdown method for cleanup
   */
  public async shutdown(): Promise<void> {
    // Cleanup resources if needed
    // This would be expanded with actual cleanup logic
    console.log('Template engine shutting down...')
  }


private async getCachedRender(key: string): Promise<RenderedDocument | null> {
    const cached = this.memoryCache.get(key)
    
    if (!cached) {
      return null
    }
    
    // Check if expired
    if (Date.now() > cached.timestamp + cached.ttl) {
      this.memoryCache.delete(key)
      return null
    }
    
    console.log(`🎯 Cache HIT for key: ${key.substring(0, 20)}...`)
    return cached.data
  }

  private async setCachedRender(key: string, result: RenderedDocument): Promise<void> {
    // Don't cache if caching is disabled
    if (!this.config.caching?.renders?.enabled) {
      return
    }
    
    const ttl = this.config.caching?.renders?.ttlMs || this.DEFAULT_CACHE_TTL
    
    this.memoryCache.set(key, {
      data: result,
      timestamp: Date.now(),
      ttl: ttl
    })
    
    console.log(`💾 Cache SET for key: ${key.substring(0, 20)}...`)
    
    // Simple cleanup: remove expired entries if cache gets too large
    if (this.memoryCache.size > 1000) {
      this.cleanupExpiredCache()
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, cached] of this.memoryCache.entries()) {
      if (now > cached.timestamp + cached.ttl) {
        this.memoryCache.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`)
    }
  }

  // Add method to check cache status
  public getCacheStats() {
    const now = Date.now()
    let expired = 0
    let valid = 0
    
    for (const cached of this.memoryCache.values()) {
      if (now > cached.timestamp + cached.ttl) {
        expired++
      } else {
        valid++
      }
    }
    
    return {
      total: this.memoryCache.size,
      valid,
      expired,
      memoryUsage: JSON.stringify([...this.memoryCache.values()]).length
    }
  }


}