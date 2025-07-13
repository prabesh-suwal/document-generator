import { 
  ParsedTemplate, 
  ProcessedData, 
  TagInfo, 
  ArrayPath, 
  FilterCondition,
  ProcessingMetadata,
  ProcessingError,
  ProcessingWarning,
  DataProcessingError,
  FormatterContext
} from '../types/core'

export class DataProcessor {
  public process(data: any, template: ParsedTemplate, complement?: any): ProcessedData {
    const startTime = new Date()
    const computed = new Map<string, any>()
    const aggregations = new Map<string, any>()
    const errors: ProcessingError[] = []
    const warnings: ProcessingWarning[] = []

    try {
      // Prepare data object with complement
      const fullData = {
        ...data,
        complement: complement
      }

      // Process all tags
      for (const tag of template.tags) {
        try {
          let resolvedValue: any

          if (tag.arrayPath) {
            if (tag.arrayPath.index === 'i') {
              // Array iteration - mark for renderer processing
              resolvedValue = `[ARRAY_ITERATION:${tag.id}]`
            } else if (tag.arrayPath.index === '') {
              // Array aggregation - calculate now
              resolvedValue = this.calculateArrayAggregation(tag, fullData)
              aggregations.set(tag.id, resolvedValue)
            } else {
              // Specific array index
              resolvedValue = this.resolveArrayIndex(tag, fullData)
            }
          } else {
            // Regular path resolution
            resolvedValue = this.resolvePath(tag.path, fullData)
            
            // Apply formatters if any (excluding array operations)
            if (tag.formatters.length > 0 && !this.hasArrayOperation(tag.formatters)) {
              const context: FormatterContext = {
                currentData: resolvedValue,
                rootData: fullData
              }
              resolvedValue = this.executeFormatterChain(resolvedValue, tag.formatters, context, fullData)
            }
          }

          computed.set(tag.id, resolvedValue)
        } catch (error) {
          errors.push({
            code: 'TAG_RESOLUTION_ERROR',
            message: `Failed to resolve tag ${tag.path}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            tagId: tag.id,
            path: tag.path,
            context: { tag, error }
          })
          // Set empty value for failed tags to prevent rendering issues
          computed.set(tag.id, '')
        }
      }

      const endTime = new Date()
      const metadata: ProcessingMetadata = {
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        dataSize: this.calculateDataSize(data),
        tagCount: template.tags.length,
        errors,
        warnings
      }

      return {
        main: fullData,
        complement,
        computed,
        aggregations,
        metadata
      }
    } catch (error) {
      throw new DataProcessingError(
        `Data processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error, template: template.id }
      )
    }
  }

  /**
   * Calculate aggregation for array tags like {d.items[].price:aggSum()}
   */
  private calculateArrayAggregation(tag: TagInfo, data: any): any {
    const arrayData = this.getArrayData(tag.arrayPath!.basePath, data)
    
    if (!Array.isArray(arrayData) || arrayData.length === 0) {
      return 0
    }
    
    // Extract property path after []
    const propertyPath = this.extractPathAfterArrayAggregation(tag.path)
    
    // Get values from array items
    const values = arrayData.map(item => {
      let value = this.getValueByPath(item, propertyPath)
      
      // Apply non-aggregation formatters first
      const nonAggFormatters = tag.formatters.filter(f => !this.isAggregationFormatter(f.name))
      for (const formatter of nonAggFormatters) {
        value = this.applySingleFormatter(value, formatter, item, data)
      }
      
      return Number(value) || 0
    })
    
    // Apply aggregation formatters
    const aggFormatters = tag.formatters.filter(f => this.isAggregationFormatter(f.name))
    let result: any = values
    
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
      result = this.applySingleFormatter(result, formatter, {}, data)
    }
    
    return result
  }

  /**
   * Resolve specific array index like {d.items[0].name}
   */
  private resolveArrayIndex(tag: TagInfo, data: any): any {
    const arrayData = this.getArrayData(tag.arrayPath!.basePath, data)
    const index = Number(tag.arrayPath!.index)
    
    if (!Array.isArray(arrayData) || index >= arrayData.length || index < 0) {
      return ''
    }
    
    const item = arrayData[index]
    const propertyPath = this.extractPathAfterArrayIndex(tag.path)
    
    let value = this.getValueByPath(item, propertyPath)
    
    // Apply formatters
    if (tag.formatters.length > 0) {
      const context: FormatterContext = {
        currentData: item,
        rootData: data
      }
      value = this.executeFormatterChain(value, tag.formatters, context, data)
    }
    
    return value
  }

  /**
   * Execute formatter chain with proper context
   */
  private executeFormatterChain(value: any, formatters: any[], context: FormatterContext, rootData: any): any {
    return formatters.reduce((currentValue, formatter) => {
      const resolvedParams = formatter.parameters.map((param: any) => {
        if (param.type === 'dynamic' && param.path) {
          return this.resolveDynamicParameter(param.path, context, rootData)
        }
        return param.value
      })

      return this.applySingleFormatter(currentValue, { ...formatter, parameters: resolvedParams }, context.currentData, rootData)
    }, value)
  }

  /**
   * Apply a single formatter to a value
   */
  private applySingleFormatter(value: any, formatter: any, itemContext: any, rootData: any): any {
    const params = formatter.parameters || []
    
    switch (formatter.name) {
      case 'add':
        return Number(value) + Number(params[0] || 0)
      case 'mul':
        return Number(value) * Number(params[0] || 1)
      case 'div':
        return Number(value) / Number(params[0] || 1)
      case 'sub':
        return Number(value) - Number(params[0] || 0)
      case 'round':
        const decimals = params[0] !== undefined ? Number(params[0]) : 0
        const multiplier = Math.pow(10, decimals)
        return Math.round(Number(value) * multiplier) / multiplier
      case 'upperCase':
        return String(value).toUpperCase()
      case 'lowerCase':
        return String(value).toLowerCase()
      case 'ucFirst':
        return String(value).replace(/\b\w/g, l => l.toUpperCase())
      case 'trim':
        return String(value).trim()
      case 'substr':
        const start = Number(params[0]) || 0
        const length = params[1] !== undefined ? Number(params[1]) : undefined
        return String(value).substr(start, length)
      case 'replace':
        const searchValue = String(params[0] || '')
        const replaceValue = String(params[1] || '')
        return String(value).replace(new RegExp(searchValue, 'g'), replaceValue)
      case 'eq':
        return value === params[0]
      case 'ne':
        return value !== params[0]
      case 'gt':
        return Number(value) > Number(params[0])
      case 'lt':
        return Number(value) < Number(params[0])
      case 'gte':
        return Number(value) >= Number(params[0])
      case 'lte':
        return Number(value) <= Number(params[0])
      case 'ifTrue':
        return value ? params[0] : (params[1] !== undefined ? params[1] : '')
      case 'ifEmpty':
        return (value === null || value === undefined || value === '') ? params[0] : value
      case 'aggSum':
        if (Array.isArray(value)) {
          return value.reduce((sum, item) => sum + (Number(item) || 0), 0)
        }
        return Number(value) || 0
      case 'aggAvg':
        if (Array.isArray(value)) {
          const sum = value.reduce((total, item) => total + (Number(item) || 0), 0)
          return value.length > 0 ? sum / value.length : 0
        }
        return Number(value) || 0
      case 'aggCount':
        return Array.isArray(value) ? value.length : (value != null ? 1 : 0)
      case 'aggMin':
        if (Array.isArray(value)) {
          return Math.min(...value.map(item => Number(item) || 0))
        }
        return Number(value) || 0
      case 'aggMax':
        if (Array.isArray(value)) {
          return Math.max(...value.map(item => Number(item) || 0))
        }
        return Number(value) || 0
      default:
        return value
    }
  }

  /**
   * Resolve dynamic parameter paths like .price in context
   */
  private resolveDynamicParameter(path: string, context: FormatterContext, rootData: any): any {
    if (path.startsWith('.')) {
      // Relative path from current context
      const relativePath = path.substring(1)
      
      if (context.currentData && typeof context.currentData === 'object') {
        const result = this.getValueByPath(context.currentData, relativePath)
        if (result !== undefined) {
          return result
        }
      }
      
      // Fallback: resolve from root data
      return this.getValueByPath(rootData, relativePath)
    } else if (path.startsWith('d.')) {
      // Absolute path from root data
      return this.getValueByPath(rootData, path.substring(2))
    } else if (path.startsWith('c.')) {
      // Complement data path
      return this.getValueByPath(rootData.complement, path.substring(2))
    }
    return undefined
  }

  /**
   * Enhanced path resolution with proper array handling
   */
  private resolvePath(path: string, data: any): any {
    if (!path) return data

    let targetData = data
    let actualPath = path

    if (path.startsWith('d.')) {
      actualPath = path.substring(2)
    } else if (path.startsWith('c.')) {
      targetData = data.complement || {}
      actualPath = path.substring(2)
    }

    return this.getValueByPath(targetData, actualPath)
  }

  /**
   * Get value by path with proper array notation handling
   */
  private getValueByPath(obj: any, path: string): any {
    if (!path) return obj
    if (obj == null) return undefined

    // Handle array notation properly
    const parts = this.splitPath(path)
    let current = obj

    for (const part of parts) {
      if (current == null) return undefined
      
      // Handle array notation like items[0]
      if (part.includes('[') && part.includes(']')) {
        const arrayMatch = part.match(/^(.+)\[(\d+|i)\]$/)
        if (arrayMatch) {
          const arrayName = arrayMatch[1]
          const index = arrayMatch[2]
          
          // Get the array
          current = current[arrayName]
          
          if (Array.isArray(current)) {
            if (index === 'i') {
              // For 'i', return the array itself for iteration context
              return current
            } else {
              // For numeric index, get the specific item
              const numIndex = parseInt(index)
              if (!isNaN(numIndex) && numIndex >= 0 && numIndex < current.length) {
                current = current[numIndex]
              } else {
                return undefined
              }
            }
          } else {
            return undefined
          }
        } else {
          // Not a valid array notation, treat as regular property
          current = current[part]
        }
      } else {
        // Regular property access
        current = current[part]
      }
    }

    return current
  }

  /**
   * Split path into parts while preserving array notation
   */
  private splitPath(path: string): string[] {
    const parts: string[] = []
    let currentPart = ''
    let inBrackets = false
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i]
      
      if (char === '[') {
        inBrackets = true
        currentPart += char
      } else if (char === ']') {
        inBrackets = false
        currentPart += char
      } else if (char === '.' && !inBrackets) {
        if (currentPart) {
          parts.push(currentPart)
          currentPart = ''
        }
      } else {
        currentPart += char
      }
    }
    
    if (currentPart) {
      parts.push(currentPart)
    }
    
    return parts
  }

  /**
   * Get array data from base path
   */
  private getArrayData(basePath: string, data: any): any[] {
    const cleanPath = basePath.replace(/^d\./, '')
    const value = this.getValueByPath(data, cleanPath)
    return Array.isArray(value) ? value : []
  }

  /**
   * Extract path after array aggregation notation
   */
  private extractPathAfterArrayAggregation(path: string): string {
    const match = path.match(/\[\]\.(.+)$/)
    return match ? match[1] : ''
  }

  /**
   * Extract path after array index notation
   */
  private extractPathAfterArrayIndex(path: string): string {
    const match = path.match(/\[\d+\]\.(.+)$/)
    return match ? match[1] : ''
  }

  /**
   * Check if formatters contain aggregation operations
   */
  private hasArrayOperation(formatters: any[]): boolean {
    return formatters.some(f => this.isAggregationFormatter(f.name))
  }

  /**
   * Check if formatter is an aggregation formatter
   */
  private isAggregationFormatter(formatterName: string): boolean {
    return ['aggSum', 'aggAvg', 'aggCount', 'aggMin', 'aggMax'].includes(formatterName)
  }

  private resolveArrayPath(arrayPath: ArrayPath, data: any): any {
    const baseArray = this.resolvePath(arrayPath.basePath, data)
    
    if (!Array.isArray(baseArray)) {
      return undefined
    }

    // Handle different array access patterns
    if (arrayPath.index !== undefined) {
      if (arrayPath.index === 'i') {
        // Return the array for iteration context
        return baseArray
      } else if (typeof arrayPath.index === 'string' && arrayPath.index.startsWith('i')) {
        // Handle i+1, i-1 etc. - would need iteration context
        return baseArray
      } else if (typeof arrayPath.index === 'number') {
        return baseArray[arrayPath.index]
      }
    }

    if (arrayPath.filter) {
      return this.filterArray(baseArray, arrayPath.filter)
    }

    // Return entire array for iteration
    return baseArray
  }

  private filterArray(array: any[], filter: FilterCondition): any[] {
    return array.filter(item => {
      const itemValue = this.resolvePath(filter.property, item)
      
      switch (filter.operator) {
        case 'eq':
          return itemValue === filter.value
        case 'ne':
          return itemValue !== filter.value
        case 'gt':
          return itemValue > filter.value
        case 'lt':
          return itemValue < filter.value
        case 'gte':
          return itemValue >= filter.value
        case 'lte':
          return itemValue <= filter.value
        case 'contains':
          return String(itemValue).includes(String(filter.value))
        default:
          return false
      }
    })
  }

  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length
    } catch {
      return 0
    }
  }
}