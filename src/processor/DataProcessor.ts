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

import { FormatterRegistry } from '../formatters/FormatterRegistry'

import { v4 as uuidv4 } from 'uuid'

export class DataProcessor {
  private formatterRegistry?: FormatterRegistry

private currentRootData: any = null

  constructor(formatterRegistry?: FormatterRegistry) {
    this.formatterRegistry = formatterRegistry
  }

  public process(data: any, template: ParsedTemplate, complement?: any): ProcessedData {
  this.currentRootData = data // Store for context resolution
  
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
      console.log(`🔍 Processing tag: ${tag.raw}`)
      console.log(`  arrayPath:`, tag.arrayPath)
      console.log(`  arrayPath?.index:`, tag.arrayPath?.index)

      try {
        let resolvedValue: any

        if (tag.arrayPath) {
          if (tag.arrayPath.index === 'i') {
            console.log(`  → Taking iteration branch`)
            // Array iteration - mark for renderer processing
            resolvedValue = `[ARRAY_ITERATION:${tag.id}]`
          } else if (tag.arrayPath.index === '' || tag.arrayPath.index === undefined) {
            console.log(`  → Taking aggregation branch (index='${tag.arrayPath.index}')`)
            // Array aggregation - calculate now
            resolvedValue = this.calculateArrayAggregation(tag, fullData)
            aggregations.set(tag.id, resolvedValue)
          } else {
            console.log(`  → Taking specific index branch`)
            // Specific array index
            resolvedValue = this.resolveArrayIndex(tag, fullData)
          }
        } else {
          console.log(`  → Regular path resolution (no arrayPath)`)
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

        console.log(`  Final resolvedValue:`, resolvedValue)
        computed.set(tag.id, resolvedValue)

      } catch (error) {
        console.log(`  ❌ Error processing tag:`, error instanceof Error ? error.message : error)
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
 * Check if formatter should be applied after aggregation
 */
private isPostAggregationFormatter(formatterName: string): boolean {
  // Only these formatters make sense after aggregation
  return ['round', 'add', 'sub', 'mul', 'div', 'upperCase', 'lowerCase', 'ucFirst', 'trim'].includes(formatterName)
}


  /**
   * Calculate aggregation for array tags like {d.items[].price:aggSum()}
   */

private calculateArrayAggregation(tag: TagInfo, data: any): any {
  console.log('🔍 calculateArrayAggregation called')
  console.log(`  tag.path: ${tag.path}`)
  console.log(`  tag.arrayPath:`, tag.arrayPath)
  console.log(`  tag.formatters:`, tag.formatters.map(f => f.name))

  const arrayData = this.getArrayData(tag.arrayPath!.basePath, data)
  console.log(`  arrayData from getArrayData:`, arrayData)
  
  if (!Array.isArray(arrayData) || arrayData.length === 0) {
    return 0
  }
  
  // Extract property path after []
  const propertyPath = this.extractPathAfterArrayAggregation(tag.path)
  console.log(`  propertyPath after []: ${propertyPath}`)
  
  // Get values from array items - FIXED: Now properly handles dynamic parameters
  const values = arrayData.map((item, index) => {
    console.log(`  Processing item ${index}:`, item)
    
    let value = this.getValueByPath(item, propertyPath)
    console.log(`    Raw value from getValueByPath(item, "${propertyPath}"): ${value}`)
    
    // Apply non-aggregation formatters with proper item context
    const nonAggFormatters = tag.formatters.filter(f => !this.isAggregationFormatter(f.name))
    console.log(`    Non-agg formatters:`, nonAggFormatters.map(f => f.name))
    
    // CRITICAL FIX: Create proper context for dynamic parameter resolution
    const itemContext: FormatterContext = {
      currentData: item,  // This is the key fix - provide item context
      rootData: data
    }
    
    // Apply each formatter with the item context
    for (const formatter of nonAggFormatters) {
      console.log(`    Applying formatter: ${formatter.name}`)
      
      // Resolve parameters with item context
      const resolvedParams = formatter.parameters.map((param: any) => {
        if (param.type === 'dynamic' && param.path) {
          // FIXED: Now resolves .price relative to current item
          const resolvedValue = this.resolveDynamicParameter(param.path, itemContext, data)
          console.log(`      Dynamic param ${param.path} resolved to: ${resolvedValue}`)
          return resolvedValue
        }
        return param.value
      })
      
      const oldValue = value
      value = this.applySingleFormatter(value, { ...formatter, parameters: resolvedParams }, item, data)
      console.log(`    After ${formatter.name}: ${oldValue} → ${value}`)
    }
    
    const numericValue = Number(value) || 0
    console.log(`    Final numeric value: ${numericValue}`)
    return numericValue
  })
  
  console.log(`  All extracted values:`, values)
  
  // Apply aggregation formatters
  const aggFormatters = tag.formatters.filter(f => this.isAggregationFormatter(f.name))
  console.log(`  Aggregation formatters:`, aggFormatters.map(f => f.name))
  
  let result: any = values
  
  for (const formatter of aggFormatters) {
    console.log(`  Applying aggregation: ${formatter.name}`)
    switch (formatter.name) {
      case 'aggSum':
        result = values.reduce((sum, val) => {
          console.log(`    Adding ${val} to ${sum}`)
          return sum + val
        }, 0)
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
    console.log(`  Aggregation result: ${result}`)
  }
  
  // Apply post-aggregation formatters (like round)
  // FIXED: Only apply formatters that make sense after aggregation
  const postAggFormatters = tag.formatters.filter(f => 
    !this.isAggregationFormatter(f.name) && 
    this.isPostAggregationFormatter(f.name)
  )
  console.log(`  Post-agg formatters:`, postAggFormatters.map(f => f.name))
  
  for (const formatter of postAggFormatters) {
    const oldResult = result
    // For post-aggregation, we don't need item context
    const resolvedParams = formatter.parameters.map((param: any) => {
      if (param.type === 'dynamic' && param.path) {
        // Post-aggregation dynamic params resolve from root data
        return this.resolveDynamicParameter(param.path, { currentData: data, rootData: data }, data)
      }
      return param.value
    })
    
    result = this.applySingleFormatter(result, { ...formatter, parameters: resolvedParams }, {}, data)
    console.log(`  After post-agg ${formatter.name}: ${oldResult} → ${result}`)
  }
  
  console.log(`  🎯 Final aggregation result: ${result}`)
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
  // Use the formatter registry if available instead of manual implementations
  if (this.formatterRegistry) {
    return this.formatterRegistry.executeChain(value, formatters, context)
  }
  
  // Fallback to manual implementation
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
        const str = String(value)
        if (str.length === 0) return str
        return str.charAt(0).toUpperCase() + str.slice(1)  // Remove .toLowerCase()
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
        return value.reduce((sum, item) => sum + Number(item), 0)
      }
      return Number(value)
      case 'aggAvg':
      if (Array.isArray(value)) {
        const sum = value.reduce((sum, item) => sum + Number(item), 0)
        return value.length > 0 ? sum / value.length : 0
      }
      return Number(value)
      
    case 'aggCount':
      if (Array.isArray(value)) {
        return value.length
      }
      return 1
      
    case 'aggMin':
      if (Array.isArray(value)) {
        return Math.min(...value.map(item => Number(item)))
      }
      return Number(value)
      
    case 'aggMax':
      if (Array.isArray(value)) {
        return Math.max(...value.map(item => Number(item)))
      }
      return Number(value)
      default:
        return value
    }
  }

  /**
   * Resolve dynamic parameter paths like .price in context
   */
  private resolveDynamicParameter(path: string, context: FormatterContext, rootData: any): any {
  console.log(`      🔍 resolveDynamicParameter: path="${path}"`)
  console.log(`        context.currentData:`, context.currentData)
  
  if (path.startsWith('.')) {
    // Relative path from current context
    const relativePath = path.substring(1)
    console.log(`        Relative path: "${relativePath}"`)
    
    if (context.currentData && typeof context.currentData === 'object') {
      const result = this.getValueByPath(context.currentData, relativePath)
      console.log(`        Result from currentData: ${result}`)
      if (result !== undefined) {
        return result
      }
    }
    
    // Fallback: resolve from root data
    const fallbackResult = this.getValueByPath(rootData, relativePath)
    console.log(`        Fallback from rootData: ${fallbackResult}`)
    return fallbackResult
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

  private processArrayTag(tag: TagInfo, data: any): any {
  console.log(`🔍 processArrayTag: ${tag.path}`)
  console.log(`  arrayPath:`, tag.arrayPath)
  
  if (!tag.arrayPath) {
    return this.resolvePath(tag.path, data)
  }

  let arrayData = this.getArrayData(tag.arrayPath.basePath, data)
  console.log(`  Base array data (${arrayData.length} items):`, arrayData)
  
  // Apply filters if present
  if (tag.arrayPath.filters && tag.arrayPath.filters.length > 0) {
    console.log(`  Applying ${tag.arrayPath.filters.length} filters:`, tag.arrayPath.filters)
    arrayData = this.applyArrayFilters(arrayData, tag.arrayPath.filters)
    console.log(`  Filtered array data (${arrayData.length} items):`, arrayData)
  }
  
  // Handle different array operations
  if (tag.arrayPath.index === 'i') {
    // Array iteration with filtering
    return this.processArrayIteration(tag, arrayData)
  } else if (tag.arrayPath.index === '') {
    // Array aggregation with filtering
    return this.processArrayAggregation(tag, arrayData)
  } else if (typeof tag.arrayPath.index === 'number') {
    // Specific index access (filtering doesn't apply here)
    const originalArray = this.getArrayData(tag.arrayPath.basePath, data)
    return this.processArrayIndex(tag, originalArray)
  }
  
  return ''
}


/**
 * Helper method for compilation compatibility
 */
private processArrayIteration(tag: TagInfo, arrayData: any[]): string {
  return `[ARRAY_ITERATION:${tag.id}]`
}

// private processArrayAggregation(tag: TagInfo, arrayData: any[]): any {
//   if (!Array.isArray(arrayData) || arrayData.length === 0) {
//     return 0
//   }
  
//   // Extract property path after []
//   const propertyPath = this.extractPathAfterArrayAggregation(tag.path)
  
//   // Get values from array items - FIXED: Now properly handles dynamic parameters
//   const values = arrayData.map((item, index) => {
//     let value = this.getValueByPath(item, propertyPath)
    
//     // Apply non-aggregation formatters with proper item context
//     const nonAggFormatters = tag.formatters.filter(f => !this.isAggregationFormatter(f.name))
    
//     // CRITICAL FIX: Create proper context for dynamic parameter resolution
//     const itemContext: FormatterContext = {
//       currentData: item,  // This is the key fix - provide item context
//       rootData: this.currentRootData || {}
//     }
    
//     // Apply each formatter with the item context
//     for (const formatter of nonAggFormatters) {
//       // Resolve parameters with item context
//       const resolvedParams = formatter.parameters.map((param: any) => {
//         if (param.type === 'dynamic' && param.path) {
//           // FIXED: Now resolves .price relative to current item
//           return this.resolveDynamicParameter(param.path, itemContext, this.currentRootData || {})
//         }
//         return param.value
//       })
      
//       value = this.applySingleFormatter(value, { ...formatter, parameters: resolvedParams }, item, this.currentRootData || {})
//     }
    
//     return Number(value) || 0
//   })
  
//   // Apply aggregation formatters
//   const aggFormatters = tag.formatters.filter(f => this.isAggregationFormatter(f.name))
//   let result: any = values
  
//   for (const formatter of aggFormatters) {
//     switch (formatter.name) {
//       case 'aggSum':
//         result = values.reduce((sum, val) => sum + val, 0)
//         break
//       case 'aggAvg':
//         result = values.reduce((sum, val) => sum + val, 0) / values.length
//         break
//       case 'aggCount':
//         result = values.length
//         break
//       case 'aggMin':
//         result = Math.min(...values)
//         break
//       case 'aggMax':
//         result = Math.max(...values)
//         break
//     }
//   }
// }

/**
 * Helper method for compilation compatibility
 */
private processArrayAggregation(tag: TagInfo, arrayData: any[]): any {
  return this.calculateArrayAggregation(tag, { items: arrayData })
}

/**
 * Helper method for compilation compatibility
 */
private processArrayIndex(tag: TagInfo, arrayData: any[]): any {
  return this.resolveArrayIndex(tag, { items: arrayData })
}


// private processArrayIndex(tag: TagInfo, arrayData: any[]): any {
//   const index = Number(tag.arrayPath!.index)
  
//   if (!Array.isArray(arrayData) || index >= arrayData.length || index < 0) {
//     return ''
//   }
  
//   const item = arrayData[index]
//   const propertyPath = this.extractPathAfterArrayIndex(tag.path)
  
//   let value = this.getValueByPath(item, propertyPath)
  
//   // Apply formatters
//   if (tag.formatters.length > 0) {
//     const context: FormatterContext = {
//       currentData: item,
//       rootData: this.currentRootData || {}
//     }
//     value = this.executeFormatterChain(value, tag.formatters, context, this.currentRootData || {})
//   }
  
//   return value
// }




  /**
   * Extract path after array aggregation notation
   */
  private extractPathAfterArrayAggregation(originalPath: string): string {
  console.log(`🔍 extractPathAfterArrayAggregation: originalPath="${originalPath}"`)
  
  // For path like "d.items[].description", extract "description"
  const bracketMatch = originalPath.match(/\[\]\.(.+)$/)
  if (bracketMatch) {
    console.log(`  Extracted property: "${bracketMatch[1]}"`)
    return bracketMatch[1]
  }
  
  console.log(`  No property found after []`)
  return ''
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
      // Handle i+1, i-1 etc.
      // For now, just return the base array
      return baseArray
    } else if (typeof arrayPath.index === 'number') {
      // Specific index access
      if (arrayPath.index >= 0 && arrayPath.index < baseArray.length) {
        return baseArray[arrayPath.index]
      }
      return undefined
    }
  }

  // Apply filters if present - FIXED: Use 'filters' instead of 'filter'
  if (arrayPath.filters) {
    return this.filterArray(baseArray, arrayPath.filters)
  }

  return baseArray
}

  /**
 * Apply filters to array data
 */
private applyArrayFilters(arrayData: any[], filters: FilterCondition[]): any[] {
  if (!filters || filters.length === 0) {
    return arrayData
  }
  
  return arrayData.filter(item => {
    // All filters must pass (AND logic)
    return filters.every(filter => this.evaluateFilter(item, filter))
  })
}

private evaluateFilter(item: any, filter: FilterCondition): boolean {
  const itemValue = this.getValueByPath(item, filter.property)
  const filterValue = filter.value
  
  console.log(`🔍 Evaluating filter: ${filter.property} ${filter.operator} ${filterValue}`)
  console.log(`  Item value: ${itemValue}, Filter value: ${filterValue}`)
  
  switch (filter.operator) {
    case 'eq':
      return itemValue == filterValue  // Loose equality
    case 'ne':
      return itemValue != filterValue
    case 'gt':
      return Number(itemValue) > Number(filterValue)
    case 'lt':
      return Number(itemValue) < Number(filterValue)
    case 'gte':
      return Number(itemValue) >= Number(filterValue)
    case 'lte':
      return Number(itemValue) <= Number(filterValue)
    case 'contains':
      return String(itemValue).toLowerCase().includes(String(filterValue).toLowerCase())
    case 'startsWith':
      return String(itemValue).toLowerCase().startsWith(String(filterValue).toLowerCase())
    case 'endsWith':
      return String(itemValue).toLowerCase().endsWith(String(filterValue).toLowerCase())
    case 'in':
      // filterValue should be an array or comma-separated string
      const values = Array.isArray(filterValue) 
        ? filterValue 
        : String(filterValue).split(',').map(v => v.trim())
      return values.includes(String(itemValue))
    default:
      console.warn(`Unknown filter operator: ${filter.operator}`)
      return true
  }
}

  private filterArray(array: any[], filters: FilterCondition[]): any[] {
  return array.filter(item => {
    // All filters must pass (AND logic)
    return filters.every(filter => this.evaluateFilter(item, filter))
  })
}



  private calculateDataSize(data: any): number {
  try {
    return JSON.stringify(data).length
  } catch (error) {
    return 0
  }
}
}