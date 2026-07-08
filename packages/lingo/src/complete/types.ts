import type { ConversionResult, QuantityResult, RangeResult } from '../parse/config'

export type CompletionResult = QuantityResult | RangeResult | ConversionResult

/** How a completion was derived — for UI labels and debugging. */
export type CompletionSource =
  | 'parse'
  | 'alternative'
  | 'unit-ambiguity'
  | 'unit-prefix'
  | 'implied-unit'
  | 'range-implied'

/**
 * A ranked, fully-parsed interpretation of a (possibly partial) input.
 * `text` is canonical and re-parses to the same value (two-way guarantee).
 */
export interface Completion {
  confidence: number
  result: CompletionResult
  source: CompletionSource
  text: string
}
