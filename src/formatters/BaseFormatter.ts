
import { Formatter, FormatterMetadata, FormatterContext, FormatterCategory } from './types'

export abstract class BaseFormatter implements Formatter {
  public abstract name: string
  public abstract metadata: FormatterMetadata

  public abstract execute(value: any, params: any[], context?: FormatterContext): any

  public validate(params: any[]): boolean {
    // Default implementation - override in subclasses for specific validation
    return params.length <= this.metadata.parameterTypes.length
  }

  protected validateParamCount(params: any[], expectedMin: number, expectedMax?: number): boolean {
    const max = expectedMax ?? expectedMin
    return params.length >= expectedMin && params.length <= max
  }

  protected validateParamType(param: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof param === 'string'
      case 'number':
        return typeof param === 'number' && !isNaN(param)
      case 'boolean':
        return typeof param === 'boolean'
      case 'array':
        return Array.isArray(param)
      default:
        return true
    }
  }
}