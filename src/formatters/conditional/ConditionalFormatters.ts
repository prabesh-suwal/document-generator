
import { BaseFormatter } from '../BaseFormatter'
import { FormatterCategory, ParameterType } from '../types'

export class EqualsFormatter extends BaseFormatter {
  public name = 'eq'
  public metadata = {
    description: 'Returns true if value equals the parameter',
    category: FormatterCategory.CONDITIONAL,
    parameterTypes: [ParameterType.DYNAMIC],
    examples: [
      {
        input: 'active',
        parameters: ['active'],
        output: true,
        description: 'Check if value equals "active"'
      }
    ]
  }

  public execute(value: any, params: any[]): boolean {
    return value === params[0]
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 1)
  }
}

export class IfTrueFormatter extends BaseFormatter {
  public name = 'ifTrue'
  public metadata = {
    description: 'Returns first parameter if value is truthy, second if falsy',
    category: FormatterCategory.CONDITIONAL,
    parameterTypes: [ParameterType.DYNAMIC, ParameterType.OPTIONAL],
    examples: [
      {
        input: true,
        parameters: ['Yes', 'No'],
        output: 'Yes',
        description: 'Return "Yes" if true, "No" if false'
      }
    ]
  }

  public execute(value: any, params: any[]): any {
    return value ? params[0] : (params[1] !== undefined ? params[1] : '')
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 1, 2)
  }
}