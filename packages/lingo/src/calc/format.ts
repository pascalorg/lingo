import { roundSig } from '../core/round'
import type { CalcFormatOptions, CalcFormatStyle, CalcNode, CalcResult } from './types'

const SCALES = [
  { factor: 1e12, word: 'trillion', suffix: '' },
  { factor: 1e9, word: 'billion', suffix: 'bn' },
  { factor: 1e6, word: 'million', suffix: 'm' },
  { factor: 1e3, word: 'thousand', suffix: 'k' },
] as const

/**
 * Render an evaluated calc result. Dimensionless numbers take `style`;
 * quantities keep their unit (or convert via `unit` / `best`).
 * @example
 * ```ts
 * import { calc, formatCalc } from '@pascal-app/lingo/calc'
 * const r = calc('7m*2')
 * r.ok && formatCalc(r, { style: 'compact' }) // '14m'
 * r.ok && formatCalc(r, { style: 'scientific' }) // '14e6'
 * ```
 */
export function formatCalc(result: CalcResult, opts: CalcFormatOptions = {}): string {
  if (result.quantity) {
    const q =
      opts.unit === undefined
        ? opts.best
          ? result.quantity.toBest()
          : result.quantity
        : result.quantity.to(opts.unit)
    const style = opts.style ?? 'standard'
    if (style === 'standard' || style === 'words') {
      return q.format({ style: style === 'words' ? 'long' : 'symbol' })
    }
    return attachUnit(q, formatNumber(q.value, style === 'compact' ? 'scientific' : style))
  }
  return formatNumber(result.value, opts.style ?? 'standard')
}

/**
 * Canonical infix for a calc tree. Re-parses through `calc()`.
 * @example
 * ```ts
 * import { calc, formatExpression } from '@pascal-app/lingo/calc'
 * const r = calc('7m*2')
 * r.ok && formatExpression(r.node) // '7e6 × 2'
 * ```
 */
export function formatExpression(node: CalcNode): string {
  return emit(node, false)
}

/**
 * LaTeX for a calc tree.
 * @example
 * ```ts
 * import { calc, formatLatex } from '@pascal-app/lingo/calc'
 * const r = calc('7m*2')
 * r.ok && formatLatex(r.node) // '7 \\times 10^{6} \\times 2'
 * ```
 */
export function formatLatex(node: CalcNode): string {
  return emitLatex(node, false)
}

export function formatNumber(value: number, style: CalcFormatStyle): string {
  if (!Number.isFinite(value)) {
    return String(value)
  }
  if (style === 'standard') {
    return trimNumber(value)
  }
  if (style === 'grouped') {
    return new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 12 }).format(
      value,
    )
  }
  if (style === 'scientific') {
    return engineering(value)
  }
  const split = splitScale(value)
  if (style === 'compact') {
    if (split?.suffix) {
      return `${trimNumber(split.coef)}${split.suffix}`
    }
    const abs = Math.abs(value)
    if (abs >= 1000 || (abs > 0 && abs < 0.001)) {
      return engineering(value)
    }
    return trimNumber(value)
  }
  return split ? `${trimNumber(split.coef)} ${split.word}` : trimNumber(value)
}

function splitScale(value: number): { coef: number; suffix: string; word: string } | null {
  if (value === 0 || !Number.isFinite(value)) {
    return null
  }
  const sign = Math.sign(value)
  const abs = Math.abs(value)
  for (const scale of SCALES) {
    const coef = roundSig(abs / scale.factor, 4)
    if (coef >= 1 && coef < 1000) {
      return { coef: sign * coef, suffix: scale.suffix, word: scale.word }
    }
  }
  return null
}

function engineering(value: number): string {
  if (value === 0) {
    return '0'
  }
  const exp = Math.floor(Math.log10(Math.abs(value)))
  const eng = Math.floor(exp / 3) * 3
  const coef = roundSig(value / 10 ** eng, 4)
  return eng === 0 ? trimNumber(coef) : `${trimNumber(coef)}e${eng}`
}

function trimNumber(value: number): string {
  if (Object.is(value, -0)) {
    return '-0'
  }
  const rounded = roundSig(value, 12)
  if (Number.isInteger(rounded) && Math.abs(rounded) < Number.MAX_SAFE_INTEGER) {
    return String(rounded)
  }
  return String(rounded)
}

function emit(node: CalcNode, paren: boolean): string {
  const inner = emitInner(node)
  return paren && needsParen(node) ? `(${inner})` : inner
}

function emitInner(node: CalcNode): string {
  if (node.type === 'number') {
    return compactScientific(node.value)
  }
  if (node.type === 'quantity') {
    return node.value.format()
  }
  if (node.type === 'group') {
    return `(${emit(node.node, false)})`
  }
  if (node.type === 'percent') {
    const of = emit(node.of, true)
    const pct = percentAmount(node.percent)
    if (node.mode === 'of') {
      return `${pct}% of ${of}`
    }
    if (node.mode === 'off') {
      return `${pct}% off ${of}`
    }
    return `${of} + ${pct}%`
  }
  const op = node.op === '*' ? '×' : node.op === '/' ? '/' : node.op
  const leftParen = node.op === '*' || node.op === '/'
  return `${emit(node.left, leftParen)} ${op} ${emit(node.right, true)}`
}

function emitLatex(node: CalcNode, paren: boolean): string {
  const inner = emitLatexInner(node)
  return paren && needsParen(node) ? `\\left(${inner}\\right)` : inner
}

function emitLatexInner(node: CalcNode): string {
  if (node.type === 'number') {
    return latexNumber(node.value)
  }
  if (node.type === 'quantity') {
    return attachUnit(node.value, latexQuantityNumber(node.value.value), true)
  }
  if (node.type === 'group') {
    return `\\left(${emitLatex(node.node, false)}\\right)`
  }
  if (node.type === 'percent') {
    const of = emitLatex(node.of, true)
    const pct = latexNumber(percentAmount(node.percent))
    if (node.mode === 'of') {
      return `${pct}\\%\\text{ of }${of}`
    }
    if (node.mode === 'off') {
      return `${pct}\\%\\text{ off }${of}`
    }
    return `${of} + ${pct}\\%`
  }
  if (node.op === '/') {
    return `\\frac{${emitLatex(node.left, false)}}{${emitLatex(node.right, false)}}`
  }
  const op = node.op === '*' ? '\\times' : node.op
  return `${emitLatex(node.left, node.op === '*')} ${op} ${emitLatex(node.right, true)}`
}

function latexNumber(value: number): string {
  const text = compactScientific(value)
  const match = /^(-?[\d.]+)e(-?\d+)$/.exec(text)
  if (match) {
    return `${match[1]} \\times 10^{${match[2]}}`
  }
  return text
}

function latexQuantityNumber(value: number): string {
  const abs = Math.abs(value)
  if (Number.isFinite(value) && abs >= 0.001 && abs < 1e6) {
    return trimNumber(value)
  }
  return latexNumber(value)
}

function attachUnit(q: NonNullable<CalcResult['quantity']>, n: string, tex?: boolean): string {
  const s = q.unitInfo().symbol
  if (!s) {
    return n
  }
  if (q.kind === 'currency') {
    return `${tex ? s.replace('$', '\\$') : s}${n}`
  }
  if (s === '%' && tex) {
    return `${n}\\%`
  }
  const u = tex ? `\\mathrm{${escapeLatex(s)}}` : s
  return '°%‰′″'.includes(s[0]!) ? `${n}${u}` : tex ? `${n}\\,${u}` : `${n} ${u}`
}

function compactScientific(value: number): string {
  if (value === 0 || !Number.isFinite(value)) {
    return trimNumber(value)
  }
  const abs = Math.abs(value)
  if (abs >= 0.001 && abs < 1000) {
    return trimNumber(value)
  }
  return engineering(value)
}

function percentAmount(node: CalcNode): number {
  if (node.type === 'quantity' && node.value.kind === 'percent') {
    return node.value.value
  }
  if (node.type === 'number') {
    return node.value
  }
  return Number.NaN
}

function needsParen(node: CalcNode): boolean {
  return node.type === 'op' || node.type === 'percent'
}

function escapeLatex(text: string): string {
  return text.replace(/[%#&_]/g, '\\$&')
}
