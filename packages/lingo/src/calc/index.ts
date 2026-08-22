/**
 * Quantity arithmetic — a closed calculator over already-parsed values.
 *
 * Import from `@pascal-app/lingo/calc` (not the main entry) so the full
 * bundle stays flat. The grammar cannot express a call, a scope, or a side
 * effect: no variables, no functions, no dimensional algebra.
 */
import { toBase } from '../core/convert'
import { hasError, makeIssue, setDefaultMessages } from '../core/errors'
import { Quantity } from '../core/quantity'
import { createRegistry } from '../core/registry'
import type { LingoIssue, Span } from '../core/types'
import { registerTemperatureVocabs } from '../fuzzy/temperature'
import { en } from '../messages/en'
import {
  applySeverity,
  confidenceForIssues,
  exampleFor,
  issue,
  type ParseOptions,
  type ParserState,
  prepare,
} from '../parse/config'
import { resolveImplied } from '../parse/quantity'
import { allKinds, byteishFallbacks } from '../units/index'
import { type EvalValue, evaluate } from './eval'
import { formatCalc, formatExpression, formatLatex } from './format'
import { parseCalc } from './parse'
import type {
  CalcFail,
  CalcFormatOptions,
  CalcJSON,
  CalcNode,
  CalcOptions,
  CalcOutcome,
  CalcResult,
} from './types'

setDefaultMessages(en)

const defaultRegistry = createRegistry(allKinds)
registerTemperatureVocabs(defaultRegistry)

export { formatCalc, formatExpression, formatLatex } from './format'
export type {
  CalcFail,
  CalcFormatOptions,
  CalcFormatStyle,
  CalcJSON,
  CalcNode,
  CalcOptions,
  CalcOutcome,
  CalcResult,
} from './types'

/**
 * Evaluate a closed arithmetic expression over quantities and numbers.
 * `lingo()` never does this — mixed fields inject `calc` with `{ trigger: '=' }`
 * so `5-10 kg` stays a range.
 * @example
 * ```ts
 * import { calc } from '@pascal-app/lingo/calc'
 * const r = calc('7m*2')
 * r.ok && r.value // 14000000
 * r.ok && r.format({ style: 'words' }) // '14 million'
 * calc('9 min x 4').ok && calc('9 min x 4').format({ unit: 'h' }) // '0.6 h'
 * ```
 */
export function calc(input: string, opts?: CalcOptions): CalcOutcome {
  const trigger = opts?.trigger ?? 'always'
  const resolved = resolveOptions(opts)
  if (trigger === '=' && !input.trimStart().startsWith('=')) {
    const p = prepare(input, resolved)
    issue(p, 'NO_VALUE', { example: '"= 2 + 3 kg"' }, 0, p.text.length)
    return attachJson(fail(p))
  }
  const p = prepare(input, resolved)
  if (p.tokens.length === 0) {
    issue(p, 'EMPTY', {}, 0, p.text.length)
    return attachJson(fail(p))
  }
  let node: CalcNode | null
  try {
    node = parseCalc(p)
  } catch {
    issue(p, 'NO_VALUE', { example: exampleFor(p) }, 0, p.text.length)
    return attachJson(fail(p))
  }
  if (!node) {
    return attachJson(fail(p))
  }
  const value = evaluate(p, node)
  if (!value) {
    return attachJson(fail(p))
  }
  const quantity = finishQuantity(p, value)
  if (p.opts.kind && quantity && quantity.kind !== p.opts.kind) {
    p.issues.push(
      makeIssue(
        'KIND_MISMATCH',
        { found: quantity.kind, expected: p.opts.kind, example: exampleFor(p) },
        node.span,
        p.opts.messages,
      ),
    )
  }
  const issues = applySeverity(p, p.issues)
  if (hasError(issues)) {
    return attachJson(fail(p, issues))
  }
  const result: CalcResult = {
    ok: true,
    schemaVersion: 3,
    type: 'calc',
    text: p.src,
    span: node.span,
    issues,
    confidence: confidenceForIssues(issues, quantity?.approximate),
    value: quantity ? quantity.value : value.value,
    node,
    expression: formatExpression(node),
    latex: formatLatex(node),
    format: (formatOpts?: CalcFormatOptions) => formatCalc(result, formatOpts),
  }
  if (quantity) {
    result.quantity = quantity
  }
  return attachJson(result)
}

function finishQuantity(p: ParserState, value: EvalValue): Quantity | undefined {
  if (value.quantity) {
    return value.quantity
  }
  const implied = resolveImplied(p)
  if (!implied) {
    return
  }
  if (!p.config.bareNumbers) {
    issue(p, 'UNIT_REQUIRED', { example: exampleFor(p) }, 0, p.text.length)
    return
  }
  const unit = p.reg.unit(implied.kind, implied.unitId)
  if (!unit) {
    return
  }
  issue(p, 'UNIT_ASSUMED', { unit: unit.plural ?? `${unit.name}s` }, 0, p.text.length)
  const base = toBase(unit, value.value)
  if (!Number.isFinite(base)) {
    issue(p, 'NONFINITE', {}, 0, p.text.length)
    return
  }
  return new Quantity(p.reg, implied.kind, base, implied.unitId)
}

function resolveOptions(opts?: CalcOptions): ParseOptions {
  return {
    aliasFallbacks: byteishFallbacks,
    ...opts,
    messages: opts?.messages ?? en,
    registry: opts?.registry ?? defaultRegistry,
  }
}

function fail(p: ParserState, issues: LingoIssue[] = applySeverity(p, p.issues)): CalcFail {
  return {
    ok: false,
    schemaVersion: 3,
    type: 'failure',
    text: p.src,
    issues,
  }
}

function attachJson<T extends CalcOutcome>(result: T): T {
  Object.defineProperty(result, 'toJSON', {
    value(this: CalcOutcome): CalcJSON | Omit<CalcFail, 'candidate'> {
      if (!this.ok) {
        return {
          ok: false,
          schemaVersion: 3,
          type: 'failure',
          text: this.text,
          issues: this.issues,
        }
      }
      const json: CalcJSON = {
        ok: true,
        schemaVersion: 3,
        type: 'calc',
        text: this.text,
        span: withText(this.span, this.text),
        issues: this.issues,
        confidence: this.confidence,
        value: this.value,
        expression: this.expression,
        latex: this.latex,
      }
      if (this.quantity) {
        json.quantity = this.quantity.toJSON()
      }
      return json
    },
    enumerable: true,
    configurable: true,
    writable: true,
  })
  return result
}

function withText(span: Span, text: string): Span & { text: string } {
  return { start: span.start, end: span.end, text: text.slice(span.start, span.end) }
}
