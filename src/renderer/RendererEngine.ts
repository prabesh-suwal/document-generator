import { 
  ParsedTemplate, 
  ProcessedData, 
  RenderedDocument, 
  TagInfo,
  DocumentFormat,
  RenderMetadata,
  ProcessingWarning,
  FormatterContext
} from '../types/core'
import { FormatterRegistry } from '../formatters/FormatterRegistry'

export class RendererEngine {
  private formatterRegistry: FormatterRegistry

  constructor(formatterRegistry: FormatterRegistry) {
    this.formatterRegistry = formatterRegistry
  }

  public render(template: ParsedTemplate, processedData: ProcessedData): RenderedDocument {
    const startTime = Date.now()
    let content = template.content
    const warnings: ProcessingWarning[] = []

    try {
      // Step 1: Handle array iterations first (creates multiple lines)
      content = this.processArrayIterations(content, template.tags, processedData)
      
      // Step 2: Handle regular tag replacements
      content = this.processRegularTags(content, template.tags, processedData)
      
      // Step 3: Handle array aggregations
      content = this.processArrayAggregations(content, template.tags, processedData)
      
      const endTime = Date.now()
      const metadata: RenderMetadata = {
        templateId: template.id,
        renderTime: new Date(),
        duration: endTime - startTime,
        outputSize: Buffer.byteLength(content, 'utf8'),
        linesGenerated: content.split('\n').length
      }

      return {
        content: Buffer.from(content, 'utf8'),
        format: template.format,
        metadata,
        warnings
      }
    } catch (error) {
      throw new Error(`Rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process array iteration tags - creates multiple lines from single template lines
   */
  private processArrayIterations(content: string, tags: TagInfo[], processedData: ProcessedData): string {
    const lines = content.split('\n')
    const processedLines: string[] = []
    
    for (const line of lines) {
      const arrayTags = this.findArrayIterationTags(line, tags)
      
      if (arrayTags.length > 0) {
        // This line contains array iteration tags - expand it
        const expandedLines = this.expandLineForArrays(line, arrayTags, processedData)
        processedLines.push(...expandedLines)
      } else {
        // Regular line - keep as is
        processedLines.push(line)
      }
    }
    
    return processedLines.join('\n')
  }

  /**
   * Find array iteration tags in a line (tags with [i] index)
   */
  private findArrayIterationTags(line: string, allTags: TagInfo[]): TagInfo[] {
    return allTags.filter(tag => {
      return line.includes(tag.raw) && 
             tag.arrayPath && 
             tag.arrayPath.index === 'i'
    })
  }

  /**
   * Expand a single line containing array iteration tags into multiple lines
   */
  private expandLineForArrays(line: string, arrayTags: TagInfo[], processedData: ProcessedData): string[] {
    if (arrayTags.length === 0) return [line]
    
    // Get the primary array (assume all iteration tags in same line use same array)
    const primaryTag = arrayTags[0]
    const arrayData = this.getArrayData(primaryTag.arrayPath!.basePath, processedData.main)
    
    if (!Array.isArray(arrayData) || arrayData.length === 0) {
      return [] // No data = no lines
    }
    
    const expandedLines: string[] = []
    
    // Create one line for each array item
    for (let i = 0; i < arrayData.length; i++) {
      let expandedLine = line
      
      // Replace all array iteration tags in this line
      for (const arrayTag of arrayTags) {
        const resolvedValue = this.resolveArrayItemValue(arrayTag, i, arrayData[i], processedData)
        expandedLine = expandedLine.replace(
          new RegExp(this.escapeRegExp(arrayTag.raw), 'g'),
          String(resolvedValue || '')
        )
      }
      
      expandedLines.push(expandedLine)
    }
    
    return expandedLines
  }

  /**
   * Resolve value for a specific array item and index
   */
  private resolveArrayItemValue(tag: TagInfo, index: number, itemData: any, processedData: ProcessedData): any {
    // Extract the property path after [i]
    const pathAfterIndex = this.extractPathAfterArrayIndex(tag.path)
    
    // Get the value from the array item
    let value = this.getValueByPath(itemData, pathAfterIndex)
    
    // Apply formatters if any
    if (tag.formatters.length > 0) {
      const context: FormatterContext = {
        currentData: itemData,
        rootData: processedData.main
      }
      value = this.applyFormatters(value, tag.formatters, context)
    }
    
    return value
  }

  /**
   * Extract the property path that comes after [i] in array notation
   * Example: "d.items[i].name" → "name"
   */
  private extractPathAfterArrayIndex(path: string): string {
    const match = path.match(/\[i\]\.(.+)$/)
    return match ? match[1] : ''
  }

  /**
   * Get array data from object path
   */
  private getArrayData(basePath: string, data: any): any[] {
    const cleanPath = basePath.replace(/^d\./, '')
    const value = this.getValueByPath(data, cleanPath)
    return Array.isArray(value) ? value : []
  }

  /**
   * Get value by dot-notation path
   */
  private getValueByPath(obj: any, path: string): any {
    if (!path) return obj
    if (obj == null) return undefined
    
    const parts = path.split('.')
    let current = obj
    
    for (const part of parts) {
      if (current == null) return undefined
      current = current[part]
    }
    
    return current
  }

  /**
   * Apply formatter chain to a value
   */
  private applyFormatters(value: any, formatters: any[], context: FormatterContext): any {
    let result = value
    
    for (const formatter of formatters) {
      const resolvedParams = formatter.parameters.map((param: any) => {
        if (param.type === 'dynamic' && param.path) {
          return this.resolveDynamicParameter(param, context)
        }
        return param.value
      })
      
      result = this.applySingleFormatter(result, formatter.name, resolvedParams, context)
    }
    
    return result
  }

  /**
   * Resolve dynamic formatter parameter
   */
  private resolveDynamicParameter(parameter: any, context: FormatterContext): any {
    const path = parameter.path
    
    if (path.startsWith('.')) {
      // Relative path - resolve from current item context
      return this.getValueByPath(context.currentData, path.substring(1))
    } else if (path.startsWith('d.')) {
      // Absolute path - resolve from root data
      return this.getValueByPath(context.rootData, path.substring(2))
    } else if (path.startsWith('c.')) {
      // Complement data path
      return this.getValueByPath(context.rootData.complement, path.substring(2))
    }
    
    return parameter.value
  }

  /**
   * Apply a single formatter to a value
   */
  private applySingleFormatter(value: any, formatterName: string, parameters: any[], context: FormatterContext): any {
    switch (formatterName) {
      case 'round':
        const decimals = parameters[0] !== undefined ? Number(parameters[0]) : 0
        return Math.round(Number(value) * Math.pow(10, decimals)) / Math.pow(10, decimals)
        
      case 'mul':
        return Number(value) * Number(parameters[0] || 1)
        
      case 'add':
        return Number(value) + Number(parameters[0] || 0)
        
      case 'sub':
        return Number(value) - Number(parameters[0] || 0)
        
      case 'div':
        return Number(value) / Number(parameters[0] || 1)
        
      case 'upperCase':
        return String(value).toUpperCase()
        
      case 'lowerCase':
        return String(value).toLowerCase()
        
      case 'ucFirst':
        return String(value).replace(/\b\w/g, l => l.toUpperCase())
        
      case 'trim':
        return String(value).trim()
        
      case 'substr':
        const start = Number(parameters[0]) || 0
        const length = parameters[1] !== undefined ? Number(parameters[1]) : undefined
        return String(value).substr(start, length)
        
      case 'replace':
        const searchValue = String(parameters[0] || '')
        const replaceValue = String(parameters[1] || '')
        return String(value).replace(new RegExp(searchValue, 'g'), replaceValue)
        
      case 'ifTrue':
        const trueValue = parameters[0]
        const falseValue = parameters[1] !== undefined ? parameters[1] : ''
        return value ? trueValue : falseValue
        
      case 'eq':
        return value === parameters[0]
        
      case 'ne':
        return value !== parameters[0]
        
      case 'gt':
        return Number(value) > Number(parameters[0])
        
      case 'lt':
        return Number(value) < Number(parameters[0])
        
      case 'gte':
        return Number(value) >= Number(parameters[0])
        
      case 'lte':
        return Number(value) <= Number(parameters[0])
        
      case 'ifEmpty':
        return (value === null || value === undefined || value === '') ? parameters[0] : value
        
      default:
        // Try to use the formatter registry if available
        try {
          if (this.formatterRegistry) {
            const formatter = this.formatterRegistry.get(formatterName)
            if (formatter) {
              return formatter.execute(value, parameters, context)
            }
          }
        } catch (error) {
          console.warn(`Failed to execute formatter ${formatterName}:`, error)
        }
        return value
    }
  }

  /**
   * Process regular (non-array) tag replacements
   */
  private processRegularTags(content: string, tags: TagInfo[], processedData: ProcessedData): string {
    let processedContent = content
    
    for (const tag of tags) {
      // Skip array iteration tags (already processed)
      if (tag.arrayPath && tag.arrayPath.index === 'i') {
        continue
      }
      
      // Skip array aggregation tags (processed later)
      if (tag.arrayPath && tag.arrayPath.index === '') {
        continue
      }
      
      // Get resolved value from processed data
      const resolvedValue = processedData.computed.get(tag.id)
      if (resolvedValue !== undefined && resolvedValue !== `[ARRAY_ITERATION:${tag.id}]`) {
        processedContent = processedContent.replace(
          new RegExp(this.escapeRegExp(tag.raw), 'g'),
          String(resolvedValue)
        )
      }
    }
    
    return processedContent
  }

  /**
   * Process array aggregation tags (like {d.items[].price:aggSum()})
   */
  private processArrayAggregations(content: string, tags: TagInfo[], processedData: ProcessedData): string {
    let processedContent = content
    
    for (const tag of tags) {
      // Only process array aggregation tags
      if (tag.arrayPath && tag.arrayPath.index === '') {
        const aggregatedValue = processedData.aggregations.get(tag.id) || 
                              processedData.computed.get(tag.id)
        
        if (aggregatedValue !== undefined) {
          processedContent = processedContent.replace(
            new RegExp(this.escapeRegExp(tag.raw), 'g'),
            String(aggregatedValue)
          )
        }
      }
    }
    
    return processedContent
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Extract path after array aggregation notation
   * Example: "d.items[].price" → "price"
   */
  private extractPathAfterArrayAggregation(path: string): string {
    const match = path.match(/\[\]\.(.+)$/)
    return match ? match[1] : ''
  }

   /**
   * Check if formatter is an aggregation formatter
   */
  private isAggregationFormatter(formatterName: string): boolean {
    return ['aggSum', 'aggAvg', 'aggCount', 'aggMin', 'aggMax'].includes(formatterName)
  }

/**
   * Calculate aggregation for array tags (backup method if not pre-calculated)
   */
  private calculateAggregation(tag: TagInfo, data: any): any {
    const arrayData = this.getArrayData(tag.arrayPath!.basePath, data)
    
    if (!Array.isArray(arrayData) || arrayData.length === 0) {
      return 0
    }
    
    // Extract the property path after []
    const pathAfterArray = this.extractPathAfterArrayAggregation(tag.path)
    
    // Get values from all array items
    const values = arrayData.map(item => {
      let value = this.getValueByPath(item, pathAfterArray)
      
      // Apply non-aggregation formatters first
      const nonAggFormatters = tag.formatters.filter(f => !this.isAggregationFormatter(f.name))
      for (const formatter of nonAggFormatters) {
        const context: FormatterContext = {
          currentData: item,
          rootData: data
        }
        value = this.applySingleFormatter(value, formatter.name, formatter.parameters || [], context)
      }
      
      return Number(value) || 0
    })

    
    // Apply aggregation formatters
    const aggFormatters = tag.formatters.filter(f => this.isAggregationFormatter(f.name))
    let result: any = values  // Change the type declaration
    
    for (const formatter of aggFormatters) {
      switch (formatter.name) {
        case 'aggSum':
          result = values.reduce((sum, val) => sum + val, 0)
          break
        case 'aggAvg':
          result = values.reduce((sum, val) => sum + val, 0) / values.length
          break
        case 'aggCount':
          result = values.length
          break
        case 'aggMin':
          result = Math.min(...values)
          break
        case 'aggMax':
          result = Math.max(...values)
          break
      }
    }
    // Apply post-aggregation formatters (like round)
    const postAggFormatters = tag.formatters.filter(f => 
      !this.isAggregationFormatter(f.name) && 
      ['round', 'add', 'mul'].includes(f.name)
    )
    
    for (const formatter of postAggFormatters) {
      const context: FormatterContext = {
        currentData: {},
        rootData: data
      }
      result = this.applySingleFormatter(result, formatter.name, formatter.parameters || [], context)
    }
    
    return result
  }
}