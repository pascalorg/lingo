import { describe, expect, it } from 'vitest'
import { quantityField } from '../ai/quantity-fields'
import { completions } from '../complete/index'
import { createLingo, lingo } from '../index'
import { zh } from '../locales/zh'
import { calc, formatCalc, formatExpression, formatLatex } from './index'

function ok(input: string, opts?: Parameters<typeof calc>[1]) {
  const r = calc(input, opts)
  if (!r.ok) {
    throw new Error(`calc failed for "${input}": ${JSON.stringify(r.issues)}`)
  }
  return r
}

describe('calc()', () => {
  it('evaluates 7m*2 as 14 million, not 14 meters', () => {
    const r = ok('7m*2')
    expect(r.value).toBe(14_000_000)
    expect(r.quantity).toBeUndefined()
    expect(r.issues.some((issue) => issue.code === 'SCALE_ASSUMED')).toBe(true)
    expect(r.format({ style: 'words' })).toBe('14 million')
    expect(r.format({ style: 'grouped' })).toBe('14,000,000')
    expect(r.format({ style: 'scientific' })).toBe('14e6')
    expect(r.format({ style: 'compact' })).toBe('14m')
    expect(formatExpression(r.node)).toBe('7e6 × 2')
    expect(formatLatex(r.node)).toBe('7 \\times 10^{6} \\times 2')
  })

  it('reads glued m as meters when kind is length', () => {
    const r = ok('7m*2', { kind: 'length' })
    expect(r.quantity?.kind).toBe('length')
    expect(r.value).toBeCloseTo(14, 12)
    expect(r.quantity?.unit).toBe('m')
    expect(r.issues.some((issue) => issue.code === 'SCALE_ASSUMED')).toBe(false)
  })

  it('reads spaced 7 m as meters even without kind', () => {
    const r = ok('7 m*2')
    expect(r.quantity?.kind).toBe('length')
    expect(r.value).toBeCloseTo(14, 12)
  })

  it('keeps 1m80 as 1.80 m, not a million-scale reading', () => {
    const r = ok('1m80')
    expect(r.quantity?.kind).toBe('length')
    expect(r.quantity?.base).toBeCloseTo(1.8, 12)
  })

  it('scales 9 min x 4 to 36 min or 0.6 h', () => {
    const r = ok('9min x 4')
    expect(r.quantity?.kind).toBe('duration')
    expect(r.quantity?.valueIn('min')).toBeCloseTo(36, 12)
    expect(r.format()).toMatch(/36/)
    expect(r.format({ unit: 'h' })).toBe('0.6 h')
  })

  it('takes half of a mixed-unit sum', () => {
    const r = ok('half of 56kg+1700g')
    expect(r.quantity?.kind).toBe('mass')
    expect(r.quantity?.base).toBeCloseTo(28.85, 12)
  })

  it('treats and as plus so half of 56kg and 1700g matches the + form', () => {
    const plus = ok('half of 56kg+1700g')
    const joined = ok('half of 56kg and 1700g')
    expect(joined.quantity?.base).toBeCloseTo(plus.quantity!.base, 12)
  })

  it('reads glued m before and as million', () => {
    expect(ok('7m and 2').value).toBe(7_000_002)
  })

  it('reads 10% on as percent-of', () => {
    expect(ok('10% on 50 kg').quantity?.base).toBeCloseTo(5, 12)
  })

  it('does not glue compact million onto a unit', () => {
    const r = ok('2e6 * 3 kg')
    expect(r.quantity?.base).toBeCloseTo(6_000_000, 12)
    expect(r.format({ style: 'compact' })).toBe('6e6 kg')
  })

  it('uses scientific compact for trillions so t is not a tonne', () => {
    expect(ok('1 trillion').format({ style: 'compact' })).toBe('1e12')
    expect(ok('1 trillion').format({ style: 'words' })).toBe('1 trillion')
    expect(ok('1e12').value).toBe(1e12)
  })

  it('round-trips compact thousand through the existing k suffix', () => {
    expect(ok('14k').value).toBe(14_000)
    expect(ok(ok('14000').format({ style: 'compact' })).value).toBe(14_000)
  })

  it('leaves 7m*2 to calc(); lingo() does not scale m as million', () => {
    const r = lingo('7m*2')
    expect(r.ok && r.type === 'quantity' ? r.quantity.base : null).not.toBe(14_000_000)
    if (r.ok && r.type === 'quantity') {
      expect(r.quantity.kind).toBe('length')
      expect(r.quantity.base).toBeCloseTo(7, 12)
    }
  })

  it('evaluates percent-of, percent-off, and plus-percent', () => {
    expect(ok('10% of 50 kg').quantity?.base).toBeCloseTo(5, 12)
    expect(ok('10% off 50 kg').quantity?.base).toBeCloseTo(45, 12)
    expect(ok('50 kg + 10%').quantity?.base).toBeCloseTo(55, 12)
  })

  it('adds and multiplies with parentheses and word operators', () => {
    expect(ok('(2+3)*4').value).toBe(20)
    expect(ok('2 plus 3 times 4').value).toBe(14)
    expect(ok('12 * 0.75 kg').quantity?.base).toBeCloseTo(9, 12)
    expect(ok('twice 3 kg').quantity?.base).toBeCloseTo(6, 12)
  })

  it('cancels same-kind division to a ratio', () => {
    expect(ok('10 L / 2 L').value).toBeCloseTo(5, 12)
    expect(ok('10 L / 2 L').quantity).toBeUndefined()
  })

  it('rejects quantity × quantity and n / q', () => {
    const mul = calc('5 kg * 2 m')
    expect(mul.ok).toBe(false)
    expect(mul.issues[0]?.code).toBe('SCALAR_EXPECTED')
    const div = calc('10 / 2 kg')
    expect(div.ok).toBe(false)
    expect(div.issues[0]?.code).toBe('SCALAR_EXPECTED')
  })

  it('rejects mixed-kind addition and division by zero', () => {
    const mix = calc('5 kg + 2 m')
    expect(mix.ok).toBe(false)
    expect(mix.issues[0]?.code).toBe('EXPRESSION_KIND_MISMATCH')
    const zero = calc('5 / 0')
    expect(zero.ok).toBe(false)
    expect(zero.issues[0]?.code).toBe('DIVISION_BY_ZERO')
  })

  it('only evaluates when prefixed if trigger is =', () => {
    expect(calc('2+3 kg', { trigger: '=' }).ok).toBe(false)
    const r = ok('=2+3 kg', { trigger: '=' })
    expect(r.quantity?.base).toBeCloseTo(5, 12)
  })

  it('round-trips expression and compact humanize through calc()', () => {
    const r = ok('7m*2')
    const again = ok(r.expression)
    expect(again.value).toBeCloseTo(r.value, 12)
    const compact = r.format({ style: 'compact' })
    expect(compact).toBe('14m')
    expect(ok(compact).value).toBeCloseTo(14_000_000, 12)
    expect(ok(r.format({ style: 'words' })).value).toBeCloseTo(14_000_000, 12)
    expect(ok(r.format({ style: 'scientific' })).value).toBeCloseTo(14_000_000, 12)
    const qty = ok('9 min x 4')
    const back = ok(qty.format())
    expect(back.quantity?.base).toBeCloseTo(qty.quantity!.base, 12)
  })

  it('does not throw or yield NaN on hostile input', () => {
    const nasty = ['', '   ', '/', '((((', '5 / 0', '5 kg * 2 m', 'NaN * 2', '1e999 * 1e999']
    for (const input of nasty) {
      const r = calc(input)
      expect(r.ok || r.issues.length > 0, input).toBe(true)
      if (r.ok) {
        expect(Number.isFinite(r.value), input).toBe(true)
      }
    }
  })

  it('serializes enumerable toJSON without the node tree', () => {
    const json = JSON.parse(JSON.stringify(ok('7m*2')))
    expect(json.type).toBe('calc')
    expect(json.value).toBe(14_000_000)
    expect(json.node).toBeUndefined()
    expect(json.expression).toBe('7e6 × 2')
  })
})

describe('lingo() stays range-first', () => {
  it('no longer reads 2+3 kg as a silent range', () => {
    const r = lingo('2+3 kg')
    expect(r.ok).toBe(false)
    expect(r.issues.some((issue) => issue.code === 'TRAILING_INPUT')).toBe(true)
  })

  it('still reads 七八天 as a CJK adjacent range', () => {
    const zhLingo = createLingo({ locales: [zh] })
    const range = zhLingo.parseRange('七八天', { locale: 'zh' })
    expect(range.ok).toBe(true)
    if (range.ok) {
      expect(range.range.min()?.value).toBe(7)
      expect(range.range.max()?.value).toBe(8)
    }
  })

  it('warns AFFINE_DELTA_ASSUMED on additive temperature compounds', () => {
    const r = lingo('20°C + 5°C')
    expect(r.ok && r.type === 'quantity').toBe(true)
    if (r.ok && r.type === 'quantity') {
      expect(r.quantity.value).toBeCloseTo(25, 12)
      expect(r.issues.some((issue) => issue.code === 'AFFINE_DELTA_ASSUMED')).toBe(true)
    }
  })
})

describe('calc injection', () => {
  it('surfaces = 5 kg from completions when calc is injected', () => {
    const list = completions('=2+3 kg', {
      calc: (text) => calc(text, { trigger: '=' }),
    })
    const item = list.find((candidate) => candidate.source === 'calc')
    expect(item?.text).toBe('= 5 kg')
    expect(item?.result.type).toBe('calc')
  })

  it('does not steal 5-10 kg as arithmetic', () => {
    const list = completions('5-10 kg', {
      kind: 'mass',
      calc: (text) => calc(text, { trigger: '=' }),
    })
    expect(list.some((candidate) => candidate.source === 'calc')).toBe(false)
    expect(list[0]?.result.type).toBe('range')
  })

  it('lets quantityField accept 12 * 0.75 kg when calc is injected', () => {
    const field = quantityField({ kind: 'mass', unit: 'kg', calc })
    expect(field.parse('12 * 0.75 kg')).toBeCloseTo(9, 12)
    const range = field.safeParse('5-10 kg')
    expect('value' in range).toBe(false)
    const input = field['~standard'].jsonSchema.input({ target: 'draft-2020-12' })
    expect(String(input.description)).toContain('Arithmetic expressions are allowed')
  })
})

describe('formatCalc helpers', () => {
  it('formats a result without going through result.format', () => {
    const r = ok('7m*2')
    expect(formatCalc(r, { style: 'compact' })).toBe('14m')
  })
})
