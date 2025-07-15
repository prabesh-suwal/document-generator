
import { BaseFormatter } from '../BaseFormatter'
import { FormatterCategory, ParameterType } from '../types'

export class UpperCaseFormatter extends BaseFormatter {
  public name = 'upperCase'
  public metadata = {
    description: 'Converts text to uppercase',
    category: FormatterCategory.TEXT,
    parameterTypes: [],
    examples: [
      {
        input: 'hello world',
        parameters: [],
        output: 'HELLO WORLD',
        description: 'Basic uppercase conversion'
      }
    ]
  }

  public execute(value: any): string {
    return String(value).toUpperCase()
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
    description: 'Capitalizes the first letter only',
    category: FormatterCategory.TEXT,
    parameterTypes: [],
    examples: [
      {
        input: 'hello world',
        parameters: [],
        output: 'Hello world',  // Only first letter capitalized
        description: 'Capitalize first letter only'
      }
    ]
  }

  public execute(value: any): string {
    const str = String(value)
    if (str.length === 0) return str
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
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