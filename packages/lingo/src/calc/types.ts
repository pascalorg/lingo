import type { Quantity } from '../core/quantity'
import type { LingoIssue, Span } from '../core/types'
import type { LingoOptions } from '../factory'

/**
 * Closed expression node union. No symbols, calls, or extension point — the
 * grammar cannot express a side effect. Avoid: AST, formula.
 * @example
 * ```ts
 * import { calc, type CalcNode } from '@pascal-app/lingo/calc'
 * const r = calc('9 min x 4')
 * const node: CalcNode | undefined = r.ok ? r.node : undefined
 * node?.type // 'op'
 * ```
 */
export type CalcNode =
  | { type: 'number'; value: number; span: Span }
  | { type: 'quantity'; value: Quantity; span: Span }
  | { type: 'group'; node: CalcNode; span: Span }
  | {
      type: 'percent'
      of: CalcNode
      percent: CalcNode
      mode: 'of' | 'add' | 'off'
      span: Span
    }
  | { type: 'op'; op: '+' | '-' | '*' | '/'; left: CalcNode; right: CalcNode; span: Span }

/**
 * Options for `calc()`. Same bag as `lingo()`, plus a mode switch for when one
 * text box feeds both parsers.
 * @example
 * ```ts
 * import { calc, type CalcOptions } from '@pascal-app/lingo/calc'
 * const opts: CalcOptions = { kind: 'mass', unit: 'kg' }
 * calc('12 * 0.75 kg', opts).ok // true
 * ```
 */
export interface CalcOptions extends LingoOptions {
  /**
   * `'always'` (default for `calc()`): evaluate any input.
   * `'='`: only evaluate when the input starts with `=`, so a field that also
   * calls `lingo()` keeps range-first semantics on bare text.
   */
  trigger?: '=' | 'always'
}

/** How `formatCalc` / `CalcResult.format` render the evaluated number. */
export type CalcFormatStyle = 'standard' | 'grouped' | 'words' | 'scientific' | 'compact'

/**
 * Display options for an evaluated calc result.
 * @example
 * ```ts
 * import { calc } from '@pascal-app/lingo/calc'
 * const r = calc('9 min x 4')
 * r.ok && r.format({ unit: 'h' }) // '0.6 h'
 * ```
 */
export interface CalcFormatOptions {
  /** Pick a best-fit unit of the same system (`36 min` → `0.6 h`). */
  best?: boolean
  style?: CalcFormatStyle
  /** Convert the quantity into this unit before formatting. */
  unit?: string
}

/**
 * Successful `calc()` result. `expression` is the normalized infix form and
 * re-parses through `calc()`. `latex` is the same tree for display.
 * @example
 * ```ts
 * import { calc } from '@pascal-app/lingo/calc'
 * const r = calc('7m*2')
 * r.ok && r.value // 14000000
 * r.ok && r.format({ style: 'words' }) // '14 million'
 * ```
 */
export interface CalcResult {
  confidence: number
  expression: string
  format: (opts?: CalcFormatOptions) => string
  issues: LingoIssue[]
  latex: string
  node: CalcNode
  ok: true
  quantity?: Quantity
  schemaVersion: 3
  span: Span
  text: string
  toJSON?: () => CalcJSON
  type: 'calc'
  value: number
}

/** Wire JSON for a successful calc result. */
export interface CalcJSON {
  confidence: number
  expression: string
  issues: LingoIssue[]
  latex: string
  ok: true
  quantity?: ReturnType<Quantity['toJSON']>
  schemaVersion: 3
  span: Span
  text: string
  type: 'calc'
  value: number
}

/**
 * Failed `calc()` result.
 * @example
 * ```ts
 * import { calc } from '@pascal-app/lingo/calc'
 * const r = calc('5 kg * 2 m')
 * r.ok // false
 * r.issues[0]?.code // 'SCALAR_EXPECTED'
 * ```
 */
export interface CalcFail {
  candidate?: CalcResult
  issues: LingoIssue[]
  ok: false
  schemaVersion: 3
  text: string
  type: 'failure'
}

export type CalcOutcome = CalcResult | CalcFail
