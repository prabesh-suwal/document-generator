
import { Formatter, FormatterContext , FormatterCategory, ParameterType} from './types'
import { FormatterCall, FormatterParameter, ValidationResult } from '../types/core'
import { BaseFormatter } from './BaseFormatter'
export class FormatterRegistry {
  private formatters: Map<string, Formatter> = new Map()

  public register(formatter: Formatter): void {
    this.formatters.set(formatter.name, formatter)
  }

  public registerMultiple(formatters: Formatter[]): void {
    formatters.forEach(formatter => this.register(formatter))
  }

  public get(name: string): Formatter | undefined {
    return this.formatters.get(name)
  }

  public has(name: string): boolean {
    return this.formatters.has(name)
  }

  public list(): string[] {
    return Array.from(this.formatters.keys())
  }

  public getByCategory(category: string): Formatter[] {
    return Array.from(this.formatters.values())
      .filter(f => f.metadata.category === category)
  }

  public validateChain(chain: FormatterCall[]): ValidationResult {
    const errors: any[] = []
    const warnings: any[] = []

    for (const call of chain) {
      const formatter = this.formatters.get(call.name)
      
      if (!formatter) {
        errors.push({
          code: 'UNKNOWN_FORMATTER',
          message: `Unknown formatter: ${call.name}`,
          severity: 'error'
        })
        continue
      }

      // For validation, we'll be more lenient with dynamic parameters
      // since we can't resolve them without runtime context
      const paramValues = call.parameters.map(p => {
        if (p.type === 'dynamic') {
          // For dynamic parameters, use a placeholder value based on expected type
          if (p.path?.includes('price') || p.path?.includes('qty')) {
            return 1 // Numeric placeholder
          }
          return 'placeholder' // String placeholder
        }
        return p.value
      })

      // Skip validation for formatters with dynamic parameters for now
      const hasDynamicParams = call.parameters.some(p => p.type === 'dynamic')
      if (!hasDynamicParams && !formatter.validate(paramValues)) {
        errors.push({
          code: 'INVALID_PARAMETERS',
          message: `Invalid parameters for formatter ${call.name}`,
          severity: 'error'
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  public executeChain(
    value: any, 
    chain: FormatterCall[], 
    context?: FormatterContext
  ): any {
    return chain.reduce((currentValue, call) => {
      const formatter = this.formatters.get(call.name)
      if (!formatter) {
        throw new Error(`Unknown formatter: ${call.name}`)
      }

      const paramValues = this.resolveParameters(call.parameters, context)
      return formatter.execute(currentValue, paramValues, context)
    }, value)
  }

  private resolveParameters(
    parameters: FormatterParameter[], 
    context?: FormatterContext
  ): any[] {
    return parameters.map(param => {
      if (param.type === 'constant') {
        return param.value
      } else if (param.type === 'dynamic' && param.path && context) {
        return this.resolveDynamicPath(param.path, context)
      }
      return param.value
    })
  }

  private resolveDynamicPath(path: string, context: FormatterContext): any {
    if (path.startsWith('.')) {
      // Relative path from current data
      return this.getValueByPath(context.currentData, path.substring(1))
    } else if (path.startsWith('d.')) {
      // Absolute path from root data
      return this.getValueByPath(context.rootData, path.substring(2))
    }
    return undefined
  }

  private getValueByPath(obj: any, path: string): any {
    if (!path) return obj
    
    const parts = path.split('.')
    let current = obj

    for (const part of parts) {
      if (current == null) return undefined
      current = current[part]
    }

    return current
  }
  public validate(params: any[]): boolean {
    return params.length === 0
  }
} 



export class LowerCaseFormatter extends BaseFormatter {
  public name = 'lowerCase'
  public metadata = {
    description: 'Converts text to lowercase',
    category: FormatterCategory.TEXT,
    parameterTypes: [],
    examples: [
      {
        input: 'HELLO WORLD',
        parameters: [],
        output: 'hello world',
        description: 'Basic lowercase conversion'
      }
    ]
  }

  public execute(value: any): string {
    return String(value).toLowerCase()
  }

  public validate(params: any[]): boolean {
    return params.length === 0
  }
}

export class UcFirstFormatter extends BaseFormatter {
  public name = 'ucFirst'
  public metadata = {
    description: 'Capitalizes the first letter of each word',
    category: FormatterCategory.TEXT,
    parameterTypes: [],
    examples: [
      {
        input: 'hello world',
        parameters: [],
        output: 'Hello World',
        description: 'Capitalize first letter of each word'
      }
    ]
  }

  public execute(value: any): string {
    return String(value).replace(/\b\w/g, l => l.toUpperCase())
  }

  public validate(params: any[]): boolean {
    return params.length === 0
  }
}

export class TrimFormatter extends BaseFormatter {
  public name = 'trim'
  public metadata = {
    description: 'Removes whitespace from both ends of a string',
    category: FormatterCategory.TEXT,
    parameterTypes: [],
    examples: [
      {
        input: '  hello world  ',
        parameters: [],
        output: 'hello world',
        description: 'Remove leading and trailing whitespace'
      }
    ]
  }

  public execute(value: any): string {
    return String(value).trim()
  }

  public validate(params: any[]): boolean {
    return params.length === 0
  }
}

export class SubstrFormatter extends BaseFormatter {
  public name = 'substr'
  public metadata = {
    description: 'Extracts a substring from a string',
    category: FormatterCategory.TEXT,
    parameterTypes: [ParameterType.NUMBER, ParameterType.OPTIONAL],
    examples: [
      {
        input: 'hello world',
        parameters: [0, 5],
        output: 'hello',
        description: 'Extract substring from position 0, length 5'
      },
      {
        input: 'hello world',
        parameters: [6],
        output: 'world',
        description: 'Extract substring from position 6 to end'
      }
    ]
  }

  public execute(value: any, params: any[]): string {
    const str = String(value)
    const start = params[0] || 0
    const length = params[1]

    if (length !== undefined) {
      return str.substr(start, length)
    }
    return str.substr(start)
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 1, 2) &&
           this.validateParamType(params[0], 'number') &&
           (params[1] === undefined || this.validateParamType(params[1], 'number'))
  }
}

export class ReplaceFormatter extends BaseFormatter {
  public name = 'replace'
  public metadata = {
    description: 'Replaces all occurrences of a search string with a replacement',
    category: FormatterCategory.TEXT,
    parameterTypes: [ParameterType.STRING, ParameterType.STRING],
    examples: [
      {
        input: 'hello world',
        parameters: ['world', 'universe'],
        output: 'hello universe',
        description: 'Replace "world" with "universe"'
      }
    ]
  }

  public execute(value: any, params: any[]): string {
    const str = String(value)
    const search = String(params[0])
    const replacement = String(params[1] || '')
    
    return str.replace(new RegExp(search, 'g'), replacement)
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 2) &&
           this.validateParamType(params[0], 'string') &&
           this.validateParamType(params[1], 'string')
  }
}