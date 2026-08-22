import { toBase } from '../core/convert'
import { makeIssue } from '../core/errors'
import { Quantity } from '../core/quantity'
import type { IssueCode, IssueInputData, Kind, Span } from '../core/types'
import type { ParserState } from '../parse/config'
import type { CalcNode } from './types'

export interface EvalValue {
  kind: Kind | null
  quantity: Quantity | null
  span: Span
  unit: string | null
  value: number
}

export function evaluate(p: ParserState, node: CalcNode): EvalValue | null {
  if (node.type === 'number') {
    return { kind: null, unit: null, value: node.value, quantity: null, span: node.span }
  }
  if (node.type === 'quantity') {
    return {
      kind: node.value.kind,
      unit: node.value.unit,
      value: node.value.value,
      quantity: node.value,
      span: node.span,
    }
  }
  if (node.type === 'group') {
    return evaluate(p, node.node)
  }
  if (node.type === 'percent') {
    return evalPercent(p, node)
  }
  return evalOp(p, node)
}

function evalPercent(
  p: ParserState,
  node: Extract<CalcNode, { type: 'percent' }>,
): EvalValue | null {
  const of = evaluate(p, node.of)
  const pct = evaluate(p, node.percent)
  if (!(of && pct)) {
    return null
  }
  const rate = pct.value / 100
  const factor = node.mode === 'of' ? rate : node.mode === 'add' ? 1 + rate : 1 - rate
  return scaleValue(p, of, factor, node.span)
}

function evalOp(p: ParserState, node: Extract<CalcNode, { type: 'op' }>): EvalValue | null {
  const left = evaluate(p, node.left)
  const right = evaluate(p, node.right)
  if (!(left && right)) {
    return null
  }
  if (node.op === '+' || node.op === '-') {
    return evalAdd(p, node.op, left, right, node.span)
  }
  if (node.op === '*') {
    return evalMul(p, left, right, node.span)
  }
  return evalDiv(p, left, right, node.span)
}

function evalAdd(
  p: ParserState,
  op: '+' | '-',
  left: EvalValue,
  right: EvalValue,
  span: Span,
): EvalValue | null {
  const sign = op === '+' ? 1 : -1
  if (left.kind && right.kind && left.kind !== right.kind) {
    report(p, 'EXPRESSION_KIND_MISMATCH', { left: left.kind, right: right.kind }, span)
    return null
  }
  if (!(left.kind || right.kind)) {
    return finite(
      p,
      { kind: null, unit: null, value: left.value + sign * right.value, quantity: null, span },
      span,
    )
  }
  const typed = left.kind ? left : right
  const kind = typed.kind!
  const unitId = (left.unit ?? right.unit)!
  const unit = p.reg.unit(kind, unitId)
  if (!unit) {
    return null
  }
  const leftBase = left.quantity ? left.quantity.base : toBase(unit, left.value)
  const rightDelta = right.quantity
    ? right.value * (p.reg.unit(kind, right.unit!)?.factor ?? unit.factor)
    : toBase(unit, right.value) - (unit.offset ?? 0)
  if ((unit.offset || rightAffine(p, right, kind)) && left.quantity && right.quantity) {
    const deltaUnit = p.reg.unit(kind, right.unit!) ?? unit
    report(
      p,
      'AFFINE_DELTA_ASSUMED',
      { unit: deltaUnit.symbol, asDelta: `${right.value} ${deltaUnit.symbol}` },
      span,
    )
  }
  const base = leftBase + sign * rightDelta
  if (!Number.isFinite(base)) {
    report(p, 'NONFINITE', {}, span)
    return null
  }
  const quantity = new Quantity(p.reg, kind, base, unitId)
  return { kind, unit: unitId, value: quantity.value, quantity, span }
}

function evalMul(p: ParserState, left: EvalValue, right: EvalValue, span: Span): EvalValue | null {
  if (left.quantity && right.quantity) {
    report(p, 'SCALAR_EXPECTED', { op: 'multiply' }, span)
    return null
  }
  if (left.quantity) {
    return scaleValue(p, left, right.value, span)
  }
  if (right.quantity) {
    return scaleValue(p, right, left.value, span)
  }
  return finite(
    p,
    { kind: null, unit: null, value: left.value * right.value, quantity: null, span },
    span,
  )
}

function evalDiv(p: ParserState, left: EvalValue, right: EvalValue, span: Span): EvalValue | null {
  if (right.value === 0) {
    report(p, 'DIVISION_BY_ZERO', {}, span)
    return null
  }
  if (left.quantity && right.quantity) {
    if (left.kind !== right.kind) {
      report(
        p,
        'EXPRESSION_KIND_MISMATCH',
        { left: left.kind ?? 'number', right: right.kind ?? 'number' },
        span,
      )
      return null
    }
    const common = left.quantity.valueIn(left.unit!)
    const other = right.quantity.valueIn(left.unit!)
    if (other === 0) {
      report(p, 'DIVISION_BY_ZERO', {}, span)
      return null
    }
    return finite(p, { kind: null, unit: null, value: common / other, quantity: null, span }, span)
  }
  if (right.quantity && !left.quantity) {
    report(p, 'SCALAR_EXPECTED', { op: 'divide' }, span)
    return null
  }
  if (left.quantity) {
    return scaleValue(p, left, 1 / right.value, span)
  }
  return finite(
    p,
    { kind: null, unit: null, value: left.value / right.value, quantity: null, span },
    span,
  )
}

function scaleValue(p: ParserState, qty: EvalValue, factor: number, span: Span): EvalValue | null {
  if (!(qty.quantity && qty.kind && qty.unit)) {
    return finite(
      p,
      { kind: null, unit: null, value: qty.value * factor, quantity: null, span },
      span,
    )
  }
  const unit = p.reg.unit(qty.kind, qty.unit)
  if (!unit) {
    return null
  }
  const value = qty.value * factor
  if (!Number.isFinite(value)) {
    report(p, 'NONFINITE', {}, span)
    return null
  }
  const base = toBase(unit, value)
  if (!Number.isFinite(base)) {
    report(p, 'NONFINITE', {}, span)
    return null
  }
  const quantity = new Quantity(p.reg, qty.kind, base, qty.unit)
  return { kind: qty.kind, unit: qty.unit, value: quantity.value, quantity, span }
}

function rightAffine(p: ParserState, right: EvalValue, kind: Kind): boolean {
  if (!right.unit) {
    return false
  }
  return Boolean(p.reg.unit(kind, right.unit)?.offset)
}

function finite(p: ParserState, value: EvalValue, span: Span): EvalValue | null {
  if (!Number.isFinite(value.value)) {
    report(p, 'NONFINITE', {}, span)
    return null
  }
  return value
}

function report<C extends IssueCode>(
  p: ParserState,
  code: C,
  data: IssueInputData<C>,
  span: Span,
): void {
  p.issues.push(makeIssue(code, data, span, p.opts.messages))
}
