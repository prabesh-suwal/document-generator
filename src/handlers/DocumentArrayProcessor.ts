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

// Enhanced feature interfaces
interface EnhancedEngineConfig extends Partial<EngineConfig> {
  caching?: {
    templates?: CacheConfig
    renders?: CacheConfig
    conversions?: CacheConfig
  }
  conversion?: {
    enablePuppeteer?: boolean
    enableLibreOffice?: boolean
    timeout?: number
    quality?: 'low' | 'medium' | 'high'
  }
  security?: {
    enableValidation?: boolean
    sanitizeInput?: boolean
    allowDangerousPatterns?: boolean
  }
  performance?: {
    enableMonitoring?: boolean
    enableBenchmarking?: boolean
    maxConcurrentRenders?: number
  }
}

interface CacheConfig {
  enabled: boolean
  provider: 'memory' | 'redis' | 'file'
  ttlMs: number
  maxSize: number
  keyPrefix: string
}

interface QueuedRender {
  id: string
  request: RenderRequest
  priority: number
  queuedAt: Date
  startedAt?: Date
  completedAt?: Date
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result?: EnhancedRenderResult
  error?: string
}

interface QueueStatus {
  totalQueued: number
  processing: number
  completed: number
  failed: number
}

interface EnhancedRenderResult extends RenderedDocument {
  fromCache: boolean
  renderTime: number
  cacheHit: boolean
  validation?: EnhancedValidationResult
  performance?: {
    parseTime: number
    processTime: number
    renderTime: number
    totalTime: number
  }
}

interface EnhancedValidationResult {
  valid: boolean
  errors: any[]
  warnings: any[]
  suggestions: any[]
  complexity: number
  recommendations: string[]
  dataValidation?: any
  securityValidation?: any
  overall: boolean
}

interface BenchmarkResults {
  name: string
  iterations: number
  results: any[]
  avgDuration: number
  minDuration: number
  maxDuration: number
  totalDuration: number
  performanceScore: number
  recommendations: string[]
}

interface EngineStatistics {
  renders: {
    totalRenders: number
    successfulRenders: number
    failedRenders: number
    cacheHits: number
    averageRenderTime: number
    totalRenderTime: number
  }
  performance: Record<string, any>
  cache?: any
  conversion?: any
  queue: QueueStatus
  memory: any
  uptime: number
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: HealthCheck[]
  timestamp: Date
  version: string
}

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  message: string
}

export class TemplateEngine {
  private parser: TemplateParser
  private processor: DataProcessor
  private renderer: RendererEngine
  private formatterRegistry: FormatterRegistry
  private config: EnhancedEngineConfig
  
  // Enhanced features
  private cacheManager?: any // CacheManager would be implemented separately
  private conversionService?: any // ConversionService would be implemented separately
  private renderQueue: QueuedRender[] = []
  private processingQueue = false
  private stats = {
    totalRenders: 0,
    successfulRenders: 0,
    failedRenders: 0,
    cacheHits: 0,
    averageRenderTime: 0,
    totalRenderTime: 0
  }
  private performanceData = new Map<string, any>()

  constructor(config?: EnhancedEngineConfig) {
    this.config = this.mergeWithDefaultConfig(config)
    this.formatterRegistry = new FormatterRegistry()
    this.parser = new TemplateParser()
    this.processor = new DataProcessor()
    this.renderer = new RendererEngine(this.formatterRegistry)
    
    this.registerDefaultFormatters()
    this.initializeEnhancedFeatures()
  }

  /**
   * Enhanced render method with caching, validation, and monitoring
   */
  public async render(request: RenderRequest): Promise<RenderedDocument> {
    const renderTimer = this.startMeasurement('template_render')
    const startTime = Date.now()
    
    try {
      // Security validation
      if (this.config.security?.enableValidation) {
        const securityResult = this.validateSecurity(request)
        if (!securityResult.secure && !this.config.security.allowDangerousPatterns) {
          throw new Error(`Security validation failed: ${securityResult.issues.map(i => i.description).join(', ')}`)
        }
      }

      // Check cache first
      if (this.cacheManager) {
        const cacheKey = this.createRenderCacheKey(request)
        const cached = await this.getCachedRender(cacheKey)
        
        if (cached) {
          this.stats.cacheHits++
          this.endMeasurement(renderTimer)
          
          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              fromCache: true,
              renderTime: this.endMeasurement(renderTimer)
            }
          }
        }
      }

      // Parse and validate template
      const template = await this.parseTemplate(request.template)
      const validation = this.validateTemplate(template)
      
      if (!validation.valid && !this.config.security?.allowDangerousPatterns) {
        throw new Error(`Template validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
      }

      // Process data with enhanced processor (handles array operations)
      const processedData = this.processor.process(request.data, template, request.options?.complement)
      
      // Render document with enhanced renderer (handles array iteration)
      const rendered = this.renderer.render(template, processedData)
      
      // Handle format conversion if needed
      let finalResult = rendered
      if (request.options?.convertTo && request.options.convertTo !== rendered.format) {
        finalResult = await this.convertDocument(rendered, request.options.convertTo)
      }

      // Cache successful result
      if (this.cacheManager) {
        const cacheKey = this.createRenderCacheKey(request)
        await this.setCachedRender(cacheKey, finalResult)
      }

      // Update statistics
      this.updateStats(true, Date.now() - startTime)
      
      return {
        ...finalResult,
        metadata: {
          ...finalResult.metadata,
          fromCache: false,
          renderTime: this.endMeasurement(renderTimer)
        }
      }
    } catch (error) {
      this.updateStats(false, Date.now() - startTime)
      this.endMeasurement(renderTimer)
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Enhanced render method that returns detailed results
   */
  public async renderEnhanced(request: RenderRequest): Promise<EnhancedRenderResult> {
    const renderTimer = this.startMeasurement('enhanced_render')
    const startTime = Date.now()
    
    try {
      const rendered = await this.render(request)
      const measurement = this.endMeasurement(renderTimer)
      
      return {
        ...rendered,
        fromCache: rendered.metadata?.fromCache || false,
        renderTime: measurement,
        cacheHit: rendered.metadata?.fromCache || false,
        performance: {
          parseTime: 0, // Could be measured separately
          processTime: 0,
          renderTime: measurement,
          totalTime: measurement
        }
      }
    } catch (error) {
      this.endMeasurement(renderTimer)
      throw error
    }
  }

  /**
   * Batch rendering with queue management
   */
  public async renderBatch(requests: RenderRequest[]): Promise<EnhancedRenderResult[]> {
    const batchTimer = this.startMeasurement('batch_render')
    
    try {
      // Process in batches to avoid overwhelming the system
      const batchSize = this.config.performance?.maxConcurrentRenders || 5
      const results: EnhancedRenderResult[] = []
      
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize)
        const batchPromises = batch.map(request => this.renderEnhanced(request))
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
      }
      
      this.endMeasurement(batchTimer)
      return results
    } catch (error) {
      this.endMeasurement(batchTimer)
      throw error
    }
  }

  /**
   * Queue render for processing
   */
  public async queueRender(request: RenderRequest, priority = 5): Promise<string> {
    const queueId = `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const queuedRender: QueuedRender = {
      id: queueId,
      request,
      priority,
      queuedAt: new Date(),
      status: 'queued'
    }
    
    this.renderQueue.push(queuedRender)
    this.renderQueue.sort((a, b) => b.priority - a.priority) // Higher priority first
    
    // Start processing if not already running
    if (!this.processingQueue) {
      this.processQueue()
    }
    
    return queueId
  }

  /**
   * Get render queue status
   */
  public getQueueStatus(queueId?: string): QueueStatus | QueuedRender | undefined {
    if (queueId) {
      return this.renderQueue.find(item => item.id === queueId)
    }
    
    return {
      totalQueued: this.renderQueue.length,
      processing: this.renderQueue.filter(item => item.status === 'processing').length,
      completed: this.renderQueue.filter(item => item.status === 'completed').length,
      failed: this.renderQueue.filter(item => item.status === 'failed').length
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
   * Enhanced template validation with comprehensive checks
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
   * Enhanced template validation that returns detailed results
   */
  public validateTemplateEnhanced(template: ParsedTemplate, data?: any): EnhancedValidationResult {
    // Basic template validation
    const templateValidation = this.validateTemplate(template)
    
    // Calculate complexity score
    const complexity = this.calculateComplexityScore(template)
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(template, complexity)
    
    // Data compatibility validation (if data provided)
    let dataValidation = undefined
    if (data) {
      dataValidation = this.validateDataCompatibility(template, data)
    }
    
    // Security validation
    const securityValidation = this.validateTemplateSecurity(template.content)
    
    return {
      ...templateValidation,
      complexity,
      recommendations,
      suggestions: [], // Could be expanded
      dataValidation,
      securityValidation,
      overall: templateValidation.valid && 
               (dataValidation?.compatible !== false) && 
               securityValidation.secure
    }
  }

  /**
   * Performance benchmarking
   */
  public async benchmark(
    request: RenderRequest, 
    iterations = 10
  ): Promise<BenchmarkResults> {
    const benchmarkTimer = this.startMeasurement('benchmark')
    const results: number[] = []
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now()
      await this.render(request)
      const duration = performance.now() - startTime
      results.push(duration)
    }
    
    const totalDuration = results.reduce((sum, duration) => sum + duration, 0)
    const avgDuration = totalDuration / iterations
    const minDuration = Math.min(...results)
    const maxDuration = Math.max(...results)
    
    this.endMeasurement(benchmarkTimer)
    
    return {
      name: 'template_render_benchmark',
      iterations,
      results,
      avgDuration,
      minDuration,
      maxDuration,
      totalDuration,
      performanceScore: this.calculatePerformanceScore(avgDuration),
      recommendations: this.generatePerformanceRecommendations(avgDuration, maxDuration - minDuration)
    }
  }

  /**
   * Get comprehensive engine statistics
   */
  public getEngineStats(): EngineStatistics {
    return {
      renders: this.stats,
      performance: Object.fromEntries(this.performanceData),
      cache: this.cacheManager?.getStats?.(),
      conversion: this.conversionService?.getStats?.(),
      queue: this.getQueueStatus() as QueueStatus,
      memory: this.getMemoryUsage(),
      uptime: process.uptime?.() || 0
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<HealthStatus> {
    const checks: HealthCheck[] = []
    
    // Basic engine health
    try {
      const testResult = await this.render({
        template: { content: 'Hello {d.name}', format: DocumentFormat.TXT },
        data: { name: 'World' }
      })
      
      checks.push({
        name: 'engine',
        status: testResult.content.toString().includes('Hello World') ? 'healthy' : 'unhealthy',
        message: 'Basic template rendering'
      })
    } catch (error) {
      checks.push({
        name: 'engine',
        status: 'unhealthy',
        message: `Engine error: ${error instanceof Error ? error.message : 'Unknown'}`
      })
    }
    
    // Cache health
    if (this.cacheManager) {
      try {
        // Test cache operations
        checks.push({
          name: 'cache',
          status: 'healthy',
          message: 'Cache operations functional'
        })
      } catch (error) {
        checks.push({
          name: 'cache',
          status: 'unhealthy',
          message: `Cache error: ${error instanceof Error ? error.message : 'Unknown'}`
        })
      }
    }
    
    // Overall health
    const healthyCount = checks.filter(c => c.status === 'healthy').length
    const totalCount = checks.length
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyCount === totalCount) {
      overallStatus = 'healthy'
    } else if (healthyCount > totalCount / 2) {
      overallStatus = 'degraded'
    } else {
      overallStatus = 'unhealthy'
    }
    
    return {
      status: overallStatus,
      checks,
      timestamp: new Date(),
      version: '2.0.0'
    }
  }

  /**
   * Warm up caches and connections
   */
  public async warmUp(): Promise<void> {
    // Initialize conversion service if available
    if (this.conversionService) {
      try {
        await this.conversionService.warmUp?.()
      } catch {
        // Ignore warm-up errors
      }
    }
    
    // Warm up formatters
    const testTemplate = `{d.test:upperCase}`
    const testData = { test: 'warmup' }
    
    try {
      await this.render({
        template: { content: testTemplate, format: DocumentFormat.TXT },
        data: testData
      })
    } catch {
      // Ignore warm-up errors
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    // Wait for queue to finish
    while (this.renderQueue.some(item => item.status === 'processing')) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    // Shutdown services
    if (this.conversionService) {
      await this.conversionService.shutdown?.()
    }
    
    if (this.cacheManager) {
      await this.cacheManager.clearAll?.()
    }
    
    // Clear performance data
    this.performanceData.clear()
    
    console.log('Template engine shut down successfully')
  }

  // Original template engine methods (enhanced)

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
        dataSize: processedData.metadata?.dataSize || 0,
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

  // Private methods for enhanced functionality

  private async processQueue(): Promise<void> {
    if (this.processingQueue) return
    this.processingQueue = true
    
    while (this.renderQueue.length > 0) {
      const queuedRender = this.renderQueue.shift()!
      queuedRender.status = 'processing'
      queuedRender.startedAt = new Date()
      
      try {
        const result = await this.renderEnhanced(queuedRender.request)
        queuedRender.status = 'completed'
        queuedRender.completedAt = new Date()
        queuedRender.result = result
      } catch (error) {
        queuedRender.status = 'failed'
        queuedRender.error = error instanceof Error ? error.message : 'Unknown error'
        queuedRender.completedAt = new Date()
      }
    }
    
    this.processingQueue = false
  }

  private async convertDocument(document: RenderedDocument, targetFormat: DocumentFormat): Promise<RenderedDocument> {
    if (!this.conversionService) {
      throw new Error('Conversion service not available')
    }
    
    // This would integrate with a ConversionService
    // For now, return the original document
    return {
      ...document,
      format: targetFormat,
      metadata: {
        ...document.metadata,
        conversionApplied: true
      }
    }
  }

  private validateSecurity(request: RenderRequest): { secure: boolean; issues: any[] } {
    const content = typeof request.template.content === 'string' 
      ? request.template.content 
      : request.template.content?.toString() || ''
    
    return this.validateTemplateSecurity(content)
  }

  private validateTemplateSecurity(content: string): { secure: boolean; issues: any[] } {
    const issues: any[] = []
    
    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/i,
      /function\s*\(/i,
      /javascript:/i,
      /<script/i,
      /onload=/i,
      /onerror=/i
    ]
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        issues.push({
          type: 'dangerous_pattern',
          description: `Potentially dangerous pattern detected: ${pattern.source}`
        })
      }
    }
    
    return {
      secure: issues.length === 0,
      issues
    }
  }

  private validateDataCompatibility(template: ParsedTemplate, data: any): { compatible: boolean; issues: any[] } {
    const issues: any[] = []
    
    // Check if data paths exist
    for (const tag of template.tags) {
      if (tag.path.startsWith('d.')) {
        const dataPath = tag.path.substring(2)
        if (!this.hasNestedProperty(data, dataPath)) {
          issues.push({
            type: 'missing_data_path',
            path: dataPath,
            tag: tag.raw
          })
        }
      }
    }
    
    return {
      compatible: issues.length === 0,
      issues
    }
  }

  private hasNestedProperty(obj: any, path: string): boolean {
    if (!path) return true
    const parts = path.split('.')
    let current = obj
    
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return false
      if (!(part in current)) return false
      current = current[part]
    }
    
    return true
  }

  private generateRecommendations(template: ParsedTemplate, complexity: number): string[] {
    const recommendations: string[] = []
    
    if (complexity > 50) {
      recommendations.push('Consider simplifying template - high complexity score')
    }
    
    const arrayOperations = template.tags.filter(t => t.arrayPath).length
    if (arrayOperations > 5) {
      recommendations.push('Multiple array operations may impact performance')
    }
    
    const formatterChains = template.tags.filter(t => t.formatters.length > 3).length
    if (formatterChains > 0) {
      recommendations.push('Some tags have long formatter chains - consider optimization')
    }
    
    return recommendations
  }

  private generatePerformanceRecommendations(avgDuration: number, variance: number): string[] {
    const recommendations: string[] = []
    
    if (avgDuration > 50) {
      recommendations.push('Consider optimizing template complexity')
    }
    
    if (variance > avgDuration) {
      recommendations.push('Performance varies significantly, check for data size variations')
    }
    
    if (!this.cacheManager) {
      recommendations.push('Enable caching to improve performance')
    }
    
    return recommendations
  }

  private updateStats(success: boolean, duration: number): void {
    this.stats.totalRenders++
    this.stats.totalRenderTime += duration
    this.stats.averageRenderTime = this.stats.totalRenderTime / this.stats.totalRenders
    
    if (success) {
      this.stats.successfulRenders++
    } else {
      this.stats.failedRenders++
    }
  }

  private calculatePerformanceScore(avgDuration: number): number {
    // Score from 0-100, where 100 is excellent performance
    if (avgDuration < 5) return 100
    if (avgDuration < 10) return 90
    if (avgDuration < 25) return 75
    if (avgDuration < 50) return 60
    if (avgDuration < 100) return 40
    if (avgDuration < 250) return 25
    return 10
  }

  private calculateEfficiency(template: ParsedTemplate, duration: number): number {
    if (duration === 0) return Infinity
    return template.tags.length / duration
  }

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
      
      if (tag.formatters.some((f: any) => f.parameters?.some((p: any) => p.type === 'dynamic'))) {
        score += 3 // Dynamic parameters add complexity
      }
    }
    
    return score
  }

  private getMemoryUsage(): any {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100,
        external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
        rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100
      }
    }
    return null
  }

  private startMeasurement(name: string): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const measurement = {
      name,
      startTime: performance.now(),
      id
    }
    this.performanceData.set(id, measurement)
    return id
  }

  private endMeasurement(id: string): number {
    const measurement = this.performanceData.get(id)
    if (!measurement) return 0
    
    const duration = performance.now() - measurement.startTime
    measurement.endTime = performance.now()
    measurement.duration = duration
    
    // Keep performance history for statistics
    const historyKey = `${measurement.name}_history`
    const history = this.performanceData.get(historyKey) || []
    history.push(duration)
    
    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift()
    }
    
    this.performanceData.set(historyKey, history)
    return duration
  }

  private createRenderCacheKey(request: RenderRequest): string {
    // Create a unique cache key based on template and data
    const templateContent = typeof request.template.content === 'string' 
      ? request.template.content 
      : request.template.content?.toString() || ''
    
    const dataStr = JSON.stringify(request.data)
    const optionsStr = JSON.stringify(request.options || {})
    
    // Simple hash function for cache key
    const hash = this.simpleHash(templateContent + dataStr + optionsStr)
    return `render_${hash}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private async getCachedRender(key: string): Promise<RenderedDocument | null> {
    // This would integrate with actual cache implementation
    // For now, return null (no cache)
    return null
  }

  private async setCachedRender(key: string, result: RenderedDocument): Promise<void> {
    // This would integrate with actual cache implementation
    // For now, do nothing
  }

  private initializeEnhancedFeatures(): void {
    // Initialize cache manager if enabled
    if (this.config.caching?.templates?.enabled || 
        this.config.caching?.renders?.enabled || 
        this.config.caching?.conversions?.enabled) {
      // This would initialize a real CacheManager
      // For now, just note that caching is requested
      console.log('Caching requested but CacheManager not implemented')
    }
    
    // Initialize conversion service if enabled
    if (this.config.conversion?.enablePuppeteer || this.config.conversion?.enableLibreOffice) {
      // This would initialize a real ConversionService
      // For now, just note that conversion is requested
      console.log('Document conversion requested but ConversionService not implemented')
    }

    // Initialize performance monitoring
    if (this.config.performance?.enableMonitoring) {
      console.log('Performance monitoring enabled')
    }
  }

  // Original validation methods (enhanced)

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
   * Merge configuration with defaults (enhanced)
   */
  private mergeWithDefaultConfig(config?: EnhancedEngineConfig): EnhancedEngineConfig {
    const defaultConfig: EnhancedEngineConfig = {
      // Original config structure
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
        },
        enableMonitoring: true,
        enableBenchmarking: false,
        maxConcurrentRenders: 5
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
        allowExternalResources: false,
        enableValidation: true,
        sanitizeInput: true,
        allowDangerousPatterns: false
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
      },
      // Enhanced config structure
      caching: {
        templates: { 
          enabled: false, 
          provider: 'memory', 
          ttlMs: 3600000, 
          maxSize: 100, 
          keyPrefix: 'tpl' 
        },
        renders: { 
          enabled: false, 
          provider: 'memory', 
          ttlMs: 1800000, 
          maxSize: 1000, 
          keyPrefix: 'rnd' 
        },
        conversions: { 
          enabled: false, 
          provider: 'memory', 
          ttlMs: 3600000, 
          maxSize: 500, 
          keyPrefix: 'cnv' 
        }
      },
      conversion: {
        enablePuppeteer: false,
        enableLibreOffice: false,
        timeout: 30000,
        quality: 'medium'
      }
    }

    // Deep merge the configurations
    return this.deepMerge(defaultConfig, config || {})
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target }
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key])
      } else {
        result[key] = source[key]
      }
    }
    
    return result
  }
}

// Export the enhanced template engine
export { TemplateEngine }