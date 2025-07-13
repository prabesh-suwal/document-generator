import { ParsedTemplate, TagInfo } from '../types/core'

export class ValidationUtils {
  /**
   * Comprehensive template validation
   */
  public static validateTemplate(template: ParsedTemplate): TemplateValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const suggestions: ValidationSuggestion[] = []

    // Basic structure validation
    this.validateBasicStructure(template, errors)
    
    // Tag validation
    this.validateTags(template.tags, errors, warnings)
    
    // Performance validation
    this.validatePerformance(template, warnings, suggestions)
    
    // Security validation
    this.validateSecurity(template, warnings)
    
    // Best practices validation
    this.validateBestPractices(template, suggestions)

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      complexity: this.calculateComplexity(template),
      recommendations: this.generateRecommendations(template, errors, warnings)
    }
  }

  /**
   * Validate data compatibility with template
   */
  public static validateDataCompatibility(template: ParsedTemplate, data: any): DataValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const missingPaths: string[] = []
    const unusedData: string[] = []

    // Check if template paths exist in data
    for (const tag of template.tags) {
      if (tag.path.startsWith('d.')) {
        const dataPath = tag.path.substring(2)
        if (!this.pathExistsInData(dataPath, data)) {
          missingPaths.push(tag.path)
        }
      }
    }

    // Check for unused data (optional analysis)
    const usedPaths = new Set(template.tags.map(tag => tag.path))
    const availablePaths = this.extractDataPaths(data)
    
    for (const path of availablePaths) {
      if (!usedPaths.has(`d.${path}`)) {
        unusedData.push(path)
      }
    }

    return {
      compatible: errors.length === 0,
      errors,
      warnings,
      missingPaths,
      unusedData,
      coverage: this.calculateDataCoverage(template, data)
    }
  }

  private static validateBasicStructure(template: ParsedTemplate, errors: ValidationError[]): void {
    if (!template.content || template.content.trim().length === 0) {
      errors.push({
        code: 'EMPTY_TEMPLATE',
        message: 'Template content is empty',
        severity: 'error'
      })
    }

    if (template.tags.length === 0) {
      errors.push({
        code: 'NO_TAGS',
        message: 'Template contains no template tags',
        severity: 'error'
      })
    }
  }

  private static validateTags(tags: TagInfo[], errors: ValidationError[], warnings: ValidationWarning[]): void {
    const tagIds = new Set<string>()
    const pathCounts = new Map<string, number>()

    for (const tag of tags) {
      // Check for duplicate IDs
      if (tagIds.has(tag.id)) {
        errors.push({
          code: 'DUPLICATE_TAG_ID',
          message: `Duplicate tag ID: ${tag.id}`,
          severity: 'error',
          tagId: tag.id
        })
      }
      tagIds.add(tag.id)

      // Check path validity
      if (!this.isValidPath(tag.path)) {
        errors.push({
          code: 'INVALID_PATH',
          message: `Invalid path syntax: ${tag.path}`,
          severity: 'error',
          tagId: tag.id
        })
      }

      // Count path usage
      const count = pathCounts.get(tag.path) || 0
      pathCounts.set(tag.path, count + 1)

      // Validate formatters
      this.validateFormatters(tag, errors, warnings)

      // Check array operations
      this.validateArrayOperations(tag, warnings)
    }

    // Check for excessive path reuse
    for (const [path, count] of pathCounts.entries()) {
      if (count > 10) {
        warnings.push({
          code: 'EXCESSIVE_PATH_REUSE',
          message: `Path ${path} is used ${count} times, consider optimization`,
          severity: 'warning'
        })
      }
    }
  }

  private static validateFormatters(tag: TagInfo, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const knownFormatters = new Set([
      'upperCase', 'lowerCase', 'ucFirst', 'trim', 'substr', 'replace',
      'round', 'add', 'mul', 'sub', 'div',
      'eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'ifTrue', 'ifEmpty',
      'aggSum', 'aggAvg', 'aggCount', 'aggMin', 'aggMax'
    ])

    for (const formatter of tag.formatters) {
      if (!knownFormatters.has(formatter.name)) {
        warnings.push({
          code: 'UNKNOWN_FORMATTER',
          message: `Unknown formatter: ${formatter.name}`,
          severity: 'warning',
          tagId: tag.id
        })
      }

      // Check formatter parameter compatibility
      if (formatter.name === 'round' && formatter.parameters.length > 1) {
        warnings.push({
          code: 'EXCESSIVE_PARAMETERS',
          message: `Round formatter expects 0-1 parameters, got ${formatter.parameters.length}`,
          severity: 'warning',
          tagId: tag.id
        })
      }
    }
  }

  private static validateArrayOperations(tag: TagInfo, warnings: ValidationWarning[]): void {
    if (tag.arrayPath) {
      const hasArrayFormatters = tag.formatters.some(f => f.name.startsWith('agg'))
      const isArrayIteration = tag.arrayPath.index === 'i'
      const isArrayAggregation = tag.arrayPath.index === ''

      if (hasArrayFormatters && !isArrayAggregation) {
        warnings.push({
          code: 'MISMATCHED_ARRAY_OPERATION',
          message: `Array formatters used without array aggregation notation`,
          severity: 'warning',
          tagId: tag.id
        })
      }

      if (isArrayIteration && hasArrayFormatters) {
        warnings.push({
          code: 'FORMATTER_ON_ITERATION',
          message: `Aggregation formatters used on array iteration tag`,
          severity: 'warning',
          tagId: tag.id
        })
      }
    }
  }

  private static validatePerformance(template: ParsedTemplate, warnings: ValidationWarning[], suggestions: ValidationSuggestion[]): void {
    const complexity = this.calculateComplexity(template)
    
    if (complexity > 100) {
      warnings.push({
        code: 'HIGH_COMPLEXITY',
        message: `Template complexity is high (${complexity}), may impact performance`,
        severity: 'warning'
      })
      
      suggestions.push({
        type: 'performance',
        message: 'Consider breaking down complex templates into smaller components',
        impact: 'high'
      })
    }

    // Check for deep nesting
    const maxDepth = Math.max(...template.tags.map(tag => (tag.path.match(/\./g) || []).length))
    if (maxDepth > 5) {
      suggestions.push({
        type: 'performance',
        message: 'Deep object nesting detected, consider flattening data structure',
        impact: 'medium'
      })
    }
  }

  private static validateSecurity(template: ParsedTemplate, warnings: ValidationWarning[]): void {
    // Check for potentially dangerous patterns
    const content = template.content.toLowerCase()
    
    if (content.includes('<script')) {
      warnings.push({
        code: 'SCRIPT_TAG_DETECTED',
        message: 'Script tags detected in template content',
        severity: 'warning'
      })
    }

    if (content.includes('eval(') || content.includes('function(')) {
      warnings.push({
        code: 'DYNAMIC_CODE_DETECTED',
        message: 'Dynamic code execution patterns detected',
        severity: 'warning'
      })
    }
  }

  private static validateBestPractices(template: ParsedTemplate, suggestions: ValidationSuggestion[]): void {
    // Check for consistent naming
    const paths = template.tags.map(tag => tag.path)
    const hasInconsistentNaming = paths.some(path => path.includes('_')) && 
                                  paths.some(path => path.match(/[A-Z]/))
    
    if (hasInconsistentNaming) {
      suggestions.push({
        type: 'style',
        message: 'Consider using consistent naming convention (camelCase or snake_case)',
        impact: 'low'
      })
    }

    // Check for template organization
    if (template.content.length > 5000 && template.tags.length > 50) {
      suggestions.push({
        type: 'organization',
        message: 'Large template detected, consider splitting into components',
        impact: 'medium'
      })
    }
  }

  private static calculateComplexity(template: ParsedTemplate): number {
    let complexity = 0
    
    for (const tag of template.tags) {
      complexity += 1 // Base complexity
      complexity += tag.formatters.length * 2 // Formatter complexity
      
      if (tag.arrayPath) {
        complexity += tag.arrayPath.index === 'i' ? 5 : 3 // Array operation complexity
      }
      
      // Dynamic parameter complexity
      const dynamicParams = tag.formatters.reduce((count, formatter) => 
        count + formatter.parameters.filter(p => p.type === 'dynamic').length, 0)
      complexity += dynamicParams * 2
    }
    
    return complexity
  }

  private static generateRecommendations(
    template: ParsedTemplate, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): string[] {
    const recommendations: string[] = []
    
    if (errors.length > 0) {
      recommendations.push('Fix validation errors before using template in production')
    }
    
    if (warnings.length > 5) {
      recommendations.push('Consider addressing warnings to improve template quality')
    }
    
    const complexity = this.calculateComplexity(template)
    if (complexity > 50) {
      recommendations.push('Template complexity is high, consider optimization')
    }
    
    return recommendations
  }

  private static isValidPath(path: string): boolean {
    // Basic path validation
    if (!path || path.length === 0) return false
    if (!path.match(/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*|\[\d*\])*$/)) {
      return false
    }
    return true
  }

  private static pathExistsInData(path: string, data: any): boolean {
    try {
      const segments = path.split('.')
      let current = data
      
      for (const segment of segments) {
        if (current == null) return false
        
        if (segment.includes('[') && segment.includes(']')) {
          const arrayMatch = segment.match(/^(.+)\[(\d*)\]$/)
          if (arrayMatch) {
            const [, arrayName] = arrayMatch
            current = current[arrayName]
            if (!Array.isArray(current)) return false
            if (current.length === 0) return false
            current = current[0] // Check first item for structure
          }
        } else {
          current = current[segment]
        }
      }
      
      return current !== undefined
    } catch {
      return false
    }
  }

  private static extractDataPaths(data: any, prefix = ''): string[] {
    const paths: string[] = []
    
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const key in data) {
        const currentPath = prefix ? `${prefix}.${key}` : key
        paths.push(currentPath)
        
        if (typeof data[key] === 'object' && data[key] !== null) {
          paths.push(...this.extractDataPaths(data[key], currentPath))
        }
      }
    }
    
    return paths
  }

  private static calculateDataCoverage(template: ParsedTemplate, data: any): number {
    const totalPaths = template.tags.filter(tag => tag.path.startsWith('d.')).length
    if (totalPaths === 0) return 1
    
    const validPaths = template.tags.filter(tag => 
      tag.path.startsWith('d.') && this.pathExistsInData(tag.path.substring(2), data)
    ).length
    
    return validPaths / totalPaths
  }
}

interface TemplateValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions: ValidationSuggestion[]
  complexity: number
  recommendations: string[]
}

interface DataValidationResult {
  compatible: boolean
  errors: string[]
  warnings: string[]
  missingPaths: string[]
  unusedData: string[]
  coverage: number
}

interface ValidationError {
  code: string
  message: string
  severity: 'error'
  tagId?: string
  line?: number
}

interface ValidationWarning {
  code: string
  message: string
  severity: 'warning'
  tagId?: string
}

interface ValidationSuggestion {
  type: 'performance' | 'style' | 'organization' | 'security'
  message: string
  impact: 'low' | 'medium' | 'high'
}
