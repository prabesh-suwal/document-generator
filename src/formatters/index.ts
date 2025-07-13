
// Export base classes and types
export { BaseFormatter } from './BaseFormatter'
export { FormatterRegistry } from './FormatterRegistry'
export * from './types'

// Export all formatter implementations
export * from './text/TextFormatters'
export * from './number/NumberFormatters'
export * from './conditional/ConditionalFormatters'
export * from './aggregation/AggregationFormatters'

// Convenience export for commonly used formatters
import {
  UpperCaseFormatter,
  LowerCaseFormatter,
  UcFirstFormatter,
  TrimFormatter,
  SubstrFormatter,
  ReplaceFormatter
} from './text/TextFormatters'

import {
  RoundFormatter,
  AddFormatter,
  MultiplyFormatter
} from './number/NumberFormatters'

import {
  EqualsFormatter,
  IfTrueFormatter
} from './conditional/ConditionalFormatters'

import {
  AggSumFormatter,
  AggAvgFormatter,
  AggCountFormatter,
  AggMinFormatter,
  AggMaxFormatter
} from './aggregation/AggregationFormatters'

export const DEFAULT_FORMATTERS = [
  new UpperCaseFormatter(),
  new LowerCaseFormatter(),
  new UcFirstFormatter(),
  new TrimFormatter(),
  new SubstrFormatter(),
  new ReplaceFormatter(),
  new RoundFormatter(),
  new AddFormatter(),
  new MultiplyFormatter(),
  new EqualsFormatter(),
  new IfTrueFormatter(),
  new AggSumFormatter(),
  new AggAvgFormatter(),
  new AggCountFormatter(),
  new AggMinFormatter(),
  new AggMaxFormatter()
]