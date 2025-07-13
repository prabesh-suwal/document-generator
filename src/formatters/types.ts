
export interface Formatter {
  name: string
  execute(value: any, params: any[], context?: FormatterContext): any
  validate(params: any[]): boolean
  metadata: FormatterMetadata
}

export interface FormatterMetadata {
  description: string
  category: FormatterCategory
  parameterTypes: ParameterType[]
  examples: FormatterExample[]
}

export interface FormatterExample {
  input: any
  parameters: any[]
  output: any
  description: string
}

export interface FormatterContext {
  currentData: any
  rootData: any
  locale?: string
  timezone?: string
}

export enum FormatterCategory {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  ARRAY = 'array',
  CONDITIONAL = 'conditional',
  MATH = 'math',
  AGGREGATION = 'aggregation',
  UTILITY = 'utility'
}

export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DYNAMIC = 'dynamic',
  OPTIONAL = 'optional'
}