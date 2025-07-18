export { TemplateEngine } from './engine/TemplateEngine'
export { TemplateParser } from './parser/TemplateParser'
export { DataProcessor } from './processor/DataProcessor'
export { RendererEngine } from './renderer/RendererEngine'
export { FormatterRegistry } from './formatters/FormatterRegistry'

// Export document format handlers
export { 
  EnhancedTemplateEngine, 
  DocxFormatHandler,
  FormatHandlerRegistry 
} from './handlers/DocumentFormatHandlers'

// Export all types
export * from './types/core'

// Export utilities
export { DocumentUtils } from './utils/DocumentUtils'

// Export server for programmatic use
export { default as createServer } from './server'

// Export formatters
export {
  UpperCaseFormatter,
  LowerCaseFormatter,
  UcFirstFormatter,
  TrimFormatter,
  RoundFormatter,
  AddFormatter,
  MultiplyFormatter,
  EqualsFormatter,
  IfTrueFormatter
} from './formatters'

export {
  AggSumFormatter,
  AggAvgFormatter,
  AggCountFormatter,
  AggMinFormatter,
  AggMaxFormatter
} from './formatters/aggregation/AggregationFormatters'