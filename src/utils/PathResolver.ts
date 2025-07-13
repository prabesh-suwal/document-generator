export class PathResolver {
  /**
   * Advanced path resolution with support for complex array operations
   */
  public static resolvePath(path: string, data: any, context?: any): any {
    if (!path) return data
    if (data == null) return undefined

    // Handle different path prefixes
    let targetData = data
    let actualPath = path

    if (path.startsWith('d.')) {
      actualPath = path.substring(2)
    } else if (path.startsWith('c.')) {
      targetData = data.complement || {}
      actualPath = path.substring(2)
    } else if (path.startsWith('ctx.') && context) {
      targetData = context
      actualPath = path.substring(4)
    }

    return this.resolvePathSegments(actualPath, targetData)
  }

  /**
   * Resolve path with array notation and filters
   */
  public static resolvePathSegments(path: string, data: any): any {
    const segments = this.parsePathSegments(path)
    let current = data

    for (const segment of segments) {
      if (current == null) return undefined

      if (segment.type === 'property') {
        current = current[segment.name]
      } else if (segment.type === 'array') {
        if (!Array.isArray(current)) return undefined
        
        if (segment.index === 'i') {
          // Return array for iteration context
          return current
        } else if (segment.index === '') {
          // Return array for aggregation
          return current
        } else if (typeof segment.index === 'number') {
          current = current[segment.index]
        } else {
          return undefined
        }
      } else if (segment.type === 'filter') {
        if (!Array.isArray(current)) return undefined
        current = this.applyFilter(current, segment.filter!)
      }
    }

    return current
  }

  /**
   * Parse path into segments
   */
  public static parsePathSegments(path: string): PathSegment[] {
    const segments: PathSegment[] = []
    let current = ''
    let inBrackets = false
    let bracketContent = ''

    for (let i = 0; i < path.length; i++) {
      const char = path[i]

      if (char === '[' && !inBrackets) {
        if (current) {
          segments.push({ type: 'property', name: current })
          current = ''
        }
        inBrackets = true
        bracketContent = ''
      } else if (char === ']' && inBrackets) {
        // Parse bracket content
        if (bracketContent === 'i') {
          segments.push({ type: 'array', index: 'i' })
        } else if (bracketContent === '') {
          segments.push({ type: 'array', index: '' })
        } else if (/^\d+$/.test(bracketContent)) {
          segments.push({ type: 'array', index: parseInt(bracketContent) })
        } else {
          // This is a filter
          const filter = this.parseFilter(bracketContent)
          segments.push({ type: 'filter', filter })
        }
        inBrackets = false
      } else if (char === '.' && !inBrackets) {
        if (current) {
          segments.push({ type: 'property', name: current })
          current = ''
        }
      } else if (inBrackets) {
        bracketContent += char
      } else {
        current += char
      }
    }

    if (current) {
      segments.push({ type: 'property', name: current })
    }

    return segments
  }

  /**
   * Parse filter expressions like "status='active'" or "price>100"
   */
  public static parseFilter(filterStr: string): FilterExpression {
    const operators = ['>=', '<=', '!=', '==', '>', '<', '=']
    
    for (const op of operators) {
      const index = filterStr.indexOf(op)
      if (index > 0) {
        const property = filterStr.substring(0, index).trim()
        const value = filterStr.substring(index + op.length).trim()
        
        return {
          property,
          operator: this.normalizeOperator(op),
          value: this.parseValue(value)
        }
      }
    }

    throw new Error(`Invalid filter expression: ${filterStr}`)
  }

  /**
   * Apply filter to array
   */
  public static applyFilter(array: any[], filter: FilterExpression): any[] {
    return array.filter(item => {
      const itemValue = this.resolvePath(filter.property, item)
      return this.compareValues(itemValue, filter.operator, filter.value)
    })
  }

  private static normalizeOperator(op: string): FilterOperator {
    const opMap: Record<string, FilterOperator> = {
      '=': 'eq',
      '==': 'eq',
      '!=': 'ne',
      '>': 'gt',
      '<': 'lt',
      '>=': 'gte',
      '<=': 'lte'
    }
    return opMap[op] || 'eq'
  }

  private static parseValue(valueStr: string): any {
    // Remove quotes
    if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
        (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
      return valueStr.slice(1, -1)
    }
    
    // Parse numbers
    if (/^\d+$/.test(valueStr)) {
      return parseInt(valueStr)
    }
    
    if (/^\d+\.\d+$/.test(valueStr)) {
      return parseFloat(valueStr)
    }
    
    // Parse booleans
    if (valueStr === 'true') return true
    if (valueStr === 'false') return false
    if (valueStr === 'null') return null
    
    return valueStr
  }

  private static compareValues(itemValue: any, operator: FilterOperator, filterValue: any): boolean {
    switch (operator) {
      case 'eq': return itemValue === filterValue
      case 'ne': return itemValue !== filterValue
      case 'gt': return itemValue > filterValue
      case 'lt': return itemValue < filterValue
      case 'gte': return itemValue >= filterValue
      case 'lte': return itemValue <= filterValue
      case 'contains': return String(itemValue).includes(String(filterValue))
      default: return false
    }
  }
}

interface PathSegment {
  type: 'property' | 'array' | 'filter'
  name?: string
  index?: string | number
  filter?: FilterExpression
}

interface FilterExpression {
  property: string
  operator: FilterOperator
  value: any
}

type FilterOperator = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains'