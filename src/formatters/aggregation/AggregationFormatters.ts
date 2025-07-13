
import { BaseFormatter } from '../BaseFormatter'
import { FormatterCategory, ParameterType } from '../types'

export class AggSumFormatter extends BaseFormatter {
  public name = 'aggSum'
  public metadata = {
    description: 'Calculates the sum of all values in a dataset',
    category: FormatterCategory.AGGREGATION,
    parameterTypes: [ParameterType.OPTIONAL], // partition by parameter
    examples: [
      {
        input: [1, 2, 3, 4, 5],
        parameters: [],
        output: 15,
        description: 'Sum all values in array'
      }
    ]
  }

  public execute(value: any, params: any[]): number {
    if (!Array.isArray(value)) {
      // If single value, return as is
      return Number(value) || 0
    }

    return value.reduce((sum, item) => {
      const num = Number(item)
      return sum + (isNaN(num) ? 0 : num)
    }, 0)
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 0, 1)
  }
}

export class AggAvgFormatter extends BaseFormatter {
  public name = 'aggAvg'
  public metadata = {
    description: 'Calculates the average of all values in a dataset',
    category: FormatterCategory.AGGREGATION,
    parameterTypes: [ParameterType.OPTIONAL],
    examples: [
      {
        input: [1, 2, 3, 4, 5],
        parameters: [],
        output: 3,
        description: 'Average of all values'
      }
    ]
  }

  public execute(value: any, params: any[]): number {
    if (!Array.isArray(value)) {
      return Number(value) || 0
    }

    if (value.length === 0) return 0

    const sum = value.reduce((total, item) => {
      const num = Number(item)
      return total + (isNaN(num) ? 0 : num)
    }, 0)

    return sum / value.length
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 0, 1)
  }
}

export class AggCountFormatter extends BaseFormatter {
  public name = 'aggCount'
  public metadata = {
    description: 'Counts the number of items in a dataset',
    category: FormatterCategory.AGGREGATION,
    parameterTypes: [ParameterType.OPTIONAL],
    examples: [
      {
        input: [1, 2, 3, 4, 5],
        parameters: [],
        output: 5,
        description: 'Count items in array'
      }
    ]
  }

  public execute(value: any, params: any[]): number {
    if (Array.isArray(value)) {
      return value.length
    }
    return value != null ? 1 : 0
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 0, 1)
  }
}

export class AggMinFormatter extends BaseFormatter {
  public name = 'aggMin'
  public metadata = {
    description: 'Finds the minimum value in a dataset',
    category: FormatterCategory.AGGREGATION,
    parameterTypes: [ParameterType.OPTIONAL],
    examples: [
      {
        input: [1, 2, 3, 4, 5],
        parameters: [],
        output: 1,
        description: 'Find minimum value'
      }
    ]
  }

  public execute(value: any, params: any[]): number {
    if (!Array.isArray(value)) {
      return Number(value) || 0
    }

    if (value.length === 0) return 0

    return Math.min(...value.map(item => Number(item) || 0))
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 0, 1)
  }
}

export class AggMaxFormatter extends BaseFormatter {
  public name = 'aggMax'
  public metadata = {
    description: 'Finds the maximum value in a dataset',
    category: FormatterCategory.AGGREGATION,
    parameterTypes: [ParameterType.OPTIONAL],
    examples: [
      {
        input: [1, 2, 3, 4, 5],
        parameters: [],
        output: 5,
        description: 'Find maximum value'
      }
    ]
  }

  public execute(value: any, params: any[]): number {
    if (!Array.isArray(value)) {
      return Number(value) || 0
    }

    if (value.length === 0) return 0

    return Math.max(...value.map(item => Number(item) || 0))
  }

  public validate(params: any[]): boolean {
    return this.validateParamCount(params, 0, 1)
  }
}