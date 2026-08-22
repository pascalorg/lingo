import { hasError } from '../core/errors'
import { Quantity, registryOf } from '../core/quantity'
import type { Span } from '../core/types'
import { consumeCjkPostUnitHalf, prepareCjkValueTokens } from '../number/cjk'
import {
  eatPhrase,
  exampleFor,
  issue,
  type ParserState,
  symAt,
  valueStarts,
  wordAt,
} from '../parse/config'
import { toSourceSpan } from '../parse/normalize'
import { parseQty, type QtyNode } from '../parse/quantity'
import type { CalcNode } from './types'

const QTY_FLAGS = { noAdditiveJoin: true, calcScales: true } as const

const PREFIXES: readonly { factor: number; phrase: string }[] = [
  { phrase: 'half of', factor: 0.5 },
  { phrase: 'twice', factor: 2 },
  { phrase: 'double', factor: 2 },
  { phrase: 'triple', factor: 3 },
  { phrase: 'thrice', factor: 3 },
]

export function parseCalc(p: ParserState): CalcNode | null {
  let pos = 0
  if (symAt(p, pos) === '=') {
    pos++
  }
  const node = parseExpr()
  if (!node) {
    if (!hasError(p.issues)) {
      issue(p, 'NO_VALUE', { example: exampleFor(p) }, p.tokens[pos]?.start ?? 0, p.text.length)
    }
    return null
  }
  while (symAt(p, pos) === '=') {
    pos++
  }
  if (p.tokens[pos]) {
    const t = p.tokens[pos]!
    const end = p.tokens[p.tokens.length - 1]!.end
    issue(p, 'TRAILING_INPUT', { text: p.text.slice(t.start, end) }, t.start, end)
  }
  return node

  function parseExpr(): CalcNode | null {
    const prefix = tryPrefix()
    if (prefix) {
      const inner = parseExpr()
      if (!inner) {
        return null
      }
      return binary('*', prefix, inner)
    }
    return parseAdd()
  }

  function parseAdd(): CalcNode | null {
    let left = parseMul()
    if (!left) {
      return null
    }
    for (;;) {
      const op = addOp()
      if (!op) {
        return left
      }
      const right = parseMul()
      if (!right) {
        return null
      }
      if (isPercentQty(right) && !isPercentQty(left)) {
        left = {
          type: 'percent',
          of: left,
          percent: right,
          mode: op === '-' ? 'off' : 'add',
          span: join(left.span, right.span),
        }
        continue
      }
      left = binary(op, left, right)
    }
  }

  function parseMul(): CalcNode | null {
    let left = parseUnary()
    if (!left) {
      return null
    }
    for (;;) {
      const op = mulOp()
      if (!op) {
        return left
      }
      const right = parseUnary()
      if (!right) {
        return null
      }
      left = binary(op, left, right)
    }
  }

  function parseUnary(): CalcNode | null {
    const saved = snapshot()
    const primary = parsePrimary()
    if (primary) {
      return maybePercentOf(primary)
    }
    if (aborted(saved)) {
      return null
    }
    restore(saved)
    const sign = unarySign()
    if (!sign) {
      return null
    }
    const inner = parseUnary()
    if (!inner) {
      return null
    }
    return sign === '-' ? negate(inner) : inner
  }

  function parsePrimary(): CalcNode | null {
    if (symAt(p, pos) === '(') {
      const start = p.tokens[pos]!.start
      pos++
      const inner = parseExpr()
      if (!inner) {
        return null
      }
      if (symAt(p, pos) === ')') {
        pos++
      }
      const endTok = p.tokens[pos - 1]
      return {
        type: 'group',
        node: inner,
        span: toSourceSpan(p.n, start, endTok?.end ?? inner.span.end),
      }
    }
    return tryQty()
  }

  function maybePercentOf(left: CalcNode): CalcNode | null {
    if (!isPercentQty(left)) {
      return left
    }
    const w = wordAt(p, pos)
    if (w !== 'of' && w !== 'off' && w !== 'on') {
      return left
    }
    const saved = snapshot()
    const mode = w === 'off' ? 'off' : 'of'
    pos++
    const of = parseUnary()
    if (!of) {
      if (aborted(saved)) {
        return null
      }
      restore(saved)
      return left
    }
    return {
      type: 'percent',
      of,
      percent: left,
      mode,
      span: join(left.span, of.span),
    }
  }

  function tryPrefix(): CalcNode | null {
    const startPos = pos
    for (const prefix of PREFIXES) {
      const next = eatPhrase(p, pos, prefix.phrase)
      if (next < 0) {
        continue
      }
      pos = next
      return { type: 'number', value: prefix.factor, span: tokenSpan(startPos, pos) }
    }
    if (wordAt(p, pos) !== 'half') {
      return null
    }
    const nextWord = wordAt(p, pos + 1)
    if (nextWord === 'an' || nextWord === 'a') {
      return null
    }
    if (nextWord !== 'of' && !operandStarts(pos + 1)) {
      return null
    }
    const start = p.tokens[pos]!.start
    pos++
    if (nextWord === 'of') {
      pos++
    }
    const end = p.tokens[pos - 1]!.end
    return { type: 'number', value: 0.5, span: toSourceSpan(p.n, start, end) }
  }

  function tryQty(): CalcNode | null {
    const saved = snapshot()
    prepareCjkValueTokens(p.tokens, pos, p.profile.numberWords)
    const q = parseQty(p, pos, true, undefined, QTY_FLAGS)
    if (!q) {
      restore(saved)
      return null
    }
    const withHalf = applyCjkHalf(p, q)
    pos = withHalf.nextToken
    const span = toSourceSpan(p.n, withHalf.normStart, withHalf.normEnd)
    if (!Number.isFinite(withHalf.base)) {
      return null
    }
    if (withHalf.kind && withHalf.headUnit) {
      const quantity = new Quantity(p.reg, withHalf.kind, withHalf.base, withHalf.headUnit, {
        approximate: withHalf.approximate,
        parts: withHalf.parts.length > 1 ? withHalf.parts : undefined,
      })
      return { type: 'quantity', value: quantity, span }
    }
    return { type: 'number', value: withHalf.base, span }
  }

  function addOp(): '+' | '-' | null {
    const s = symAt(p, pos)
    if (s === '+' || s === '-') {
      pos++
      return s
    }
    const w = wordAt(p, pos)
    if (w && p.profile.grammar.compoundPlusWords.has(w)) {
      pos++
      return '+'
    }
    if (w && p.profile.grammar.compoundMinusWords.has(w)) {
      pos++
      return '-'
    }
    if (w && p.profile.grammar.compoundJoinWords.has(w)) {
      pos++
      return '+'
    }
    return null
  }

  function mulOp(): '*' | '/' | null {
    const s = symAt(p, pos)
    if (s === '*' || s === '×' || s === '·') {
      pos++
      return '*'
    }
    if (s === '/' || s === '÷') {
      pos++
      return '/'
    }
    const times = eatPhrase(p, pos, 'multiplied by')
    if (times >= 0) {
      pos = times
      return '*'
    }
    const divided = eatPhrase(p, pos, 'divided by')
    if (divided >= 0) {
      pos = divided
      return '/'
    }
    const w = wordAt(p, pos)
    if (w === 'x' || w === 'times') {
      pos++
      return '*'
    }
    if (w === 'over') {
      pos++
      return '/'
    }
    return null
  }

  function unarySign(): '+' | '-' | null {
    const s = symAt(p, pos)
    if (s === '+' || s === '-') {
      pos++
      return s
    }
    const w = wordAt(p, pos)
    if (w && p.profile.grammar.compoundMinusWords.has(w)) {
      pos++
      return '-'
    }
    if (w && p.profile.grammar.compoundPlusWords.has(w)) {
      pos++
      return '+'
    }
    return null
  }

  function operandStarts(i: number): boolean {
    return symAt(p, i) === '(' || valueStarts(p, i)
  }

  function snapshot(): { issues: number; pos: number } {
    return { pos, issues: p.issues.length }
  }

  function restore(saved: { issues: number; pos: number }): void {
    pos = saved.pos
    p.issues.length = saved.issues
  }

  function aborted(saved: { issues: number }): boolean {
    return hasError(p.issues.slice(saved.issues))
  }

  function tokenSpan(from: number, to: number): Span {
    const start = p.tokens[from]?.start ?? 0
    const end = p.tokens[to - 1]?.end ?? start
    return toSourceSpan(p.n, start, end)
  }

  function binary(op: '+' | '-' | '*' | '/', left: CalcNode, right: CalcNode): CalcNode {
    return { type: 'op', op, left, right, span: join(left.span, right.span) }
  }
}

function applyCjkHalf(p: ParserState, q: QtyNode): QtyNode {
  const half =
    q.kind && q.headUnit && consumeCjkPostUnitHalf(p.tokens, q.nextToken, p.profile.numberWords)
  if (!half) {
    return q
  }
  const part = q.parts[q.parts.length - 1]
  const unit = p.reg.unit(q.kind!, part?.unit ?? q.headUnit!)
  if (!unit) {
    return q
  }
  q.base += 0.5 * unit.factor
  if (part?.unit === unit.id) {
    part.value += 0.5
  } else {
    q.parts.push({ unit: unit.id, value: 0.5 })
  }
  q.normEnd = half.end
  q.nextToken = half.next
  return q
}

function isPercentQty(node: CalcNode): boolean {
  return node.type === 'quantity' && node.value.kind === 'percent'
}

function join(a: Span, b: Span): Span {
  return { start: a.start, end: b.end }
}

function negate(node: CalcNode): CalcNode {
  if (node.type === 'number') {
    return { ...node, value: -node.value }
  }
  if (node.type === 'quantity') {
    const q = node.value
    return {
      type: 'quantity',
      value: new Quantity(registryOf(q), q.kind, -q.base, q.unit, { approximate: q.approximate }),
      span: node.span,
    }
  }
  if (node.type === 'group') {
    return { ...node, node: negate(node.node) }
  }
  return {
    type: 'op',
    op: '*',
    left: { type: 'number', value: -1, span: node.span },
    right: node,
    span: node.span,
  }
}
