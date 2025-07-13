
import { BaseFormatter } from '../BaseFormatter'
import { FormatterCategory, ParameterType } from '../types'

export class RoundFormatter extends BaseFormatter {
  public name = 'round'
  public metadata = {
    description: 'Rounds a number to specified decimal places',
    category: FormatterCategory.NUMBER,
    parameterTypes: [ParameterType.OPTIONAL],
    examples: [
      {
        input: 3.14159,
        parameters: [2],
        output: 3.14,
        description: 'Round to 2 decimal places'
      },
      {
        input: 3.7,
        parameters: [],
        output: 4,
        description: 'Round to nearest integer'
      }
    ]
  }

  public execute(value: any, params: any[]): number {
    const num = Number(value)
    const decimals = params[0] !== undefined ? Number(params[0]) : 0
    
    if (isNaN(num)) return 0
    
    const multiplier = Math.pow(10, decimals)
    return Math.round(num * multiplier) / multiplier
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 0, 1) &&
           (params[0] === undefined || this.validateParamType(params[0], 'number'))
  }
}

export class AddFormatter extends BaseFormatter {
  public name = 'add'
  public metadata = {
    description: 'Adds a value to the input number',
    category: FormatterCategory.MATH,
    parameterTypes: [ParameterType.NUMBER],
    examples: [
      {
        input: 5,
        parameters: [3],
        output: 8,
        description: 'Add 3 to 5'
      }
    ]
  }

  public execute(value: any, params: any[]): number {
    const num1 = Number(value) || 0
    const num2 = Number(params[0]) || 0
    return num1 + num2
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 1) &&
           this.validateParamType(params[0], 'number')
  }
}

export class MultiplyFormatter extends BaseFormatter {
  public name = 'mul'
  public metadata = {
    description: 'Multiplies the input number by a value',
    category: FormatterCategory.MATH,
    parameterTypes: [ParameterType.NUMBER],
    examples: [
      {
        input: 5,
        parameters: [3],
        output: 15,
        description: 'Multiply 5 by 3'
      }
    ]
  }

  public execute(value: any, params: any[]): number {
    const num1 = Number(value) || 0
    const num2 = Number(params[0]) || 0
    return num1 * num2
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 1) &&
           this.validateParamType(params[0], 'number')
  }
}
