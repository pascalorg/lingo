import { describe, expect, it } from 'vitest'
import { createLingo } from '../index'
import type { LocalePack } from '../locale/types'
import { es } from '../locales/es'
import { fr } from '../locales/fr'
import { pt } from '../locales/pt'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePack(base: LocalePack, overrides: Partial<LocalePack>): LocalePack {
  return {
    ...base,
    ...overrides,
    grammar: { ...(base.grammar ?? {}), ...(overrides.grammar ?? {}) },
    numberWords: { ...(base.numberWords ?? {}), ...(overrides.numberWords ?? {}) },
  } as LocalePack
}

function qty(input: string, pack: LocalePack, locale?: string) {
  const lingo = createLingo({ locales: [pack] })
  return lingo.parseQuantity(input, { locale: locale ?? pack.locale })
}

function range(input: string, pack: LocalePack, locale?: string) {
  const lingo = createLingo({ locales: [pack] })
  return lingo.parseRange(input, { locale: locale ?? pack.locale })
}

// ─── Feature 1: tens + and-word + ones composition ──────────────────────────

describe('tens + and-word + ones composition', () => {
  it('parses Spanish treinta y cinco = 35', () => {
    const r = qty('treinta y cinco kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(35)
    }
  })

  it('parses Spanish cuarenta y dos = 42', () => {
    const r = qty('cuarenta y dos kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(42)
    }
  })

  it('parses Spanish noventa y nueve = 99', () => {
    const r = qty('noventa y nueve kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(99)
    }
  })

  it('parses Portuguese vinte e cinco = 25', () => {
    const r = qty('vinte e cinco kg', pt)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(25)
    }
  })

  it('parses Portuguese trinta e sete = 37', () => {
    const r = qty('trinta e sete kg', pt)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(37)
    }
  })

  it('parses French vingt et un = 21', () => {
    const r = qty('vingt et un kg', fr)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(21)
    }
  })

  it('parses French trente et un = 31', () => {
    const r = qty('trente et un kg', fr)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(31)
    }
  })

  // GUARD: and-word in range context must NOT be consumed as number composition
  it('preserves "entre cinco y diez kilos" as range', () => {
    const r = range('entre cinco y diez kilos', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.range.min()?.value).toBe(5)
      expect(r.range.max()?.value).toBe(10)
    }
  })

  it('preserves "entre 5 y 10 kg" as range', () => {
    const r = range('entre 5 y 10 kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.range.min()?.value).toBe(5)
      expect(r.range.max()?.value).toBe(10)
    }
  })

  it('preserves "entre 5 e 10 kg" as range in Portuguese', () => {
    const r = range('entre 5 e 10 kg', pt)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.range.min()?.value).toBe(5)
      expect(r.range.max()?.value).toBe(10)
    }
  })

  it('does not affect English (no and-word composition for English tens)', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('twenty five kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(25) // hyphen/space form still works
    }
    // "twenty and five" in English: "and" is in andWords so it composes
    // into tens+ones (same mechanism as romance languages). This is NOT
    // the same as scale-and ("one hundred and five") — it's handled by
    // the hyphen/and-word skip after tens.
    const r2 = lingo.parseQuantity('twenty and five kg')
    expect(r2.ok).toBe(true)
    if (r2.ok) {
      expect(r2.quantity.value).toBe(25)
    }
  })
})

// ─── Feature 2: Bare scale words ────────────────────────────────────────────

describe('bare scale words', () => {
  const esBare = makePack(es, {
    numberWords: { ...es.numberWords, bareScales: { cien: 100, ciento: 100, mil: 1000 } },
  })

  const ptBare = makePack(pt, {
    numberWords: { ...pt.numberWords, bareScales: { cem: 100, mil: 1000 } },
  })

  it('parses "cien gramos" = 100 g', () => {
    const r = qty('cien gramos', esBare)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(100)
      expect(r.quantity.unit).toBe('g')
    }
  })

  it('parses "mil metros" = 1000 m', () => {
    const r = qty('mil metros', esBare)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(1000)
      expect(r.quantity.unit).toBe('m')
    }
  })

  it('parses "cem quilos" = 100 kg', () => {
    const r = qty('cem quilos', ptBare)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(100)
      expect(r.quantity.unit).toBe('kg')
    }
  })

  it('English "hundred" does NOT open bare (requires "a hundred")', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('hundred kg')
    expect(r.ok).toBe(false)
  })

  it('English "a hundred" still works', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('a hundred kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(100)
    }
  })

  it('bare scale continues composing: "ciento cincuenta gramos" = 150', () => {
    const r = qty('ciento cincuenta gramos', esBare)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(150)
    }
  })
})

// ─── Feature 3: composed table ──────────────────────────────────────────────

describe('composed table (vigesimal, compound hundreds)', () => {
  const frComposed = makePack(fr, {
    numberWords: {
      ...fr.numberWords,
      composed: {
        'quatre vingts': 80,
        'quatre vingt dix': 90,
        'quatre vingt dix neuf': 99,
        'soixante dix': 70,
        'soixante quinze': 75,
      },
    },
  })

  const esComposed = makePack(es, {
    numberWords: {
      ...es.numberWords,
      bareScales: { cien: 100, ciento: 100, mil: 1000 },
      composed: { quinientos: 500, doscientos: 200, trescientos: 300 },
    },
  })

  it('parses "quatre-vingts kg" = 80', () => {
    const r = qty('quatre-vingts kg', frComposed)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(80)
    }
  })

  it('parses "quatre-vingt-dix kg" = 90', () => {
    const r = qty('quatre-vingt-dix kg', frComposed)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(90)
    }
  })

  it('parses "quatre-vingt-dix-neuf kg" = 99', () => {
    const r = qty('quatre-vingt-dix-neuf kg', frComposed)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(99)
    }
  })

  it('parses "soixante-dix kg" = 70', () => {
    const r = qty('soixante-dix kg', frComposed)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(70)
    }
  })

  it('parses "soixante-quinze kg" = 75', () => {
    const r = qty('soixante-quinze kg', frComposed)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(75)
    }
  })

  it('parses "quinientos kg" = 500', () => {
    const r = qty('quinientos kg', esComposed)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(500)
    }
  })

  it('parses "doscientos kg" = 200', () => {
    const r = qty('doscientos kg', esComposed)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(200)
    }
  })

  it('composed + scale: "mil quinientos kg" = 1500', () => {
    const r = qty('mil quinientos kg', esComposed)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(1500)
    }
  })

  it('scale + composed after and: "mille quatre-vingts kg" = 1080', () => {
    const frScale = makePack(fr, {
      numberWords: {
        ...fr.numberWords,
        bareScales: { mille: 1000 },
        composed: { 'quatre vingts': 80 },
      },
    })
    const r = qty('mille quatre-vingts kg', frScale)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(1080)
    }
  })
})

// ─── Feature 4: spoken decimal separator words ──────────────────────────────

describe('spoken decimal separator words', () => {
  it('parses English "two point five kg" = 2.5', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('two point five kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(2.5)
    }
  })

  it('parses English "three point fourteen kg" = 3.14', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('three point fourteen kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBeCloseTo(3.14, 10)
    }
  })

  it('parses Spanish "dos coma cinco kg" = 2.5', () => {
    const esDec = makePack(es, {
      numberWords: { ...es.numberWords, decimalWords: ['coma'] },
    })
    const r = qty('dos coma cinco kg', esDec)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(2.5)
    }
  })

  it('parses French "trois virgule quatorze kg" = 3.14', () => {
    const frDec = makePack(fr, {
      numberWords: { ...fr.numberWords, decimalWords: ['virgule'] },
    })
    const r = qty('trois virgule quatorze kg', frDec)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBeCloseTo(3.14, 10)
    }
  })

  it('parses Portuguese "dois virgula cinco kg" = 2.5', () => {
    const ptDec = makePack(pt, {
      numberWords: { ...pt.numberWords, decimalWords: ['virgula'] },
    })
    const r = qty('dois virgula cinco kg', ptDec)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(2.5)
    }
  })

  it('decimal word followed by digits: "two point 5 kg" = 2.5', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('two point 5 kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(2.5)
    }
  })
})

// ─── Feature 5: leading multi-word approximant phrases ──────────────────────

describe('leading multi-word approximant phrases', () => {
  const esApprox = makePack(es, {
    grammar: { ...es.grammar, approximatePhrases: ['mas o menos'] },
  })

  const ptApprox = makePack(pt, {
    grammar: { ...pt.grammar, approximatePhrases: ['mais ou menos', 'por volta de'] },
  })

  const frApprox = makePack(fr, {
    grammar: { ...fr.grammar, approximatePhrases: ['a peu pres'] },
  })

  it('parses "mas o menos 5 kilos" as approximate', () => {
    const r = qty('mas o menos 5 kilos', esApprox)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(5)
      expect(r.quantity.approximate).toBe(true)
    }
  })

  it('parses "mais ou menos 5 quilos" as approximate', () => {
    const r = qty('mais ou menos 5 quilos', ptApprox)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(5)
      expect(r.quantity.approximate).toBe(true)
    }
  })

  it('parses "por volta de 3 litros" as approximate', () => {
    const r = qty('por volta de 3 litros', ptApprox)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(3)
      expect(r.quantity.approximate).toBe(true)
    }
  })

  it('parses "a peu pres 5 kg" as approximate', () => {
    const r = qty('a peu pres 5 kg', frApprox)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(5)
      expect(r.quantity.approximate).toBe(true)
    }
  })

  it('English has no approximatePhrases by default (empty)', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('about 5 kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(5)
      expect(r.quantity.approximate).toBe(true)
    }
  })

  it('approx phrase composes with "A a B" separator range (range parses)', () => {
    const r = range('mas o menos 5 a 10 kg', esApprox)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.range.min()?.value).toBe(5)
      expect(r.range.max()?.value).toBe(10)
      // Note: approximate propagation to separator-style ranges is a known
      // architectural limit (same in English "about 5 to 10 kg") — the range
      // still parses successfully with the phrase consumed as a qualifier.
    }
  })
})

// ─── Regression: English unchanged ──────────────────────────────────────────

describe('English behavior unchanged', () => {
  it('"a hundred" still parses', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('a hundred kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(100)
    }
  })

  it('"1,500 kg" still parses', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('1,500 kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(1500)
    }
  })

  it('"twenty-five kg" still works', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('twenty-five kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(25)
    }
  })

  it('"one hundred and five kg" still works', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('one hundred and five kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(105)
    }
  })

  it('"between 5 and 10 kg" still parses as range', () => {
    const lingo = createLingo()
    const r = lingo.parseRange('between 5 and 10 kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.range.min()?.value).toBe(5)
      expect(r.range.max()?.value).toBe(10)
    }
  })
})

// ─── F1: spoken decimal tails as digit sequence ─────────────────────────────

describe('F1: spoken decimal tails compose as digit sequence', () => {
  it('"dos coma cinco seis kg" = 2.56 (not 2.11)', () => {
    const r = qty('dos coma cinco seis kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(2.56)
    }
  })

  it('"quinientos coma cero cinco kg" = 500.05 (leading zero preserved)', () => {
    const r = qty('quinientos coma cero cinco kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(500.05)
    }
  })

  it('"two point five six kg" = 2.56 (English)', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('two point five six kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(2.56)
    }
  })

  it('"trois virgule quatorze kg" = 3.14 (regression: multi-digit group)', () => {
    const r = qty('trois virgule quatorze kg', fr)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBeCloseTo(3.14, 10)
    }
  })

  it('"two point five kg" = 2.5 (single digit still works)', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('two point five kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(2.5)
    }
  })
})

// ─── F2: article-led scale chains ───────────────────────────────────────────

describe('F2: article-led scale chains continue composing', () => {
  it('"un millon quinientos mil kg" = 1,500,000 (ES)', () => {
    const r = qty('un millon quinientos mil kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(1_500_000)
    }
  })

  it('"um milhao quinhentos mil kg" = 1,500,000 (PT)', () => {
    const r = qty('um milhao quinhentos mil kg', pt)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(1_500_000)
    }
  })

  it('"un million cinq cent mille kg" = 1,500,000 (FR)', () => {
    const r = qty('un million cinq cent mille kg', fr)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(1_500_000)
    }
  })

  it('"a hundred kg" (en) still parses as 100', () => {
    const lingo = createLingo()
    const r = lingo.parseQuantity('a hundred kg')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(100)
    }
  })

  it('"un kg" (es) still parses as 1', () => {
    const r = qty('un kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(1)
    }
  })
})

// ─── F4: feminine veintiuna ─────────────────────────────────────────────────

describe('F4: feminine veintiuna', () => {
  it('"veintiuna pulgadas" = 21 in', () => {
    const r = qty('veintiuna pulgadas', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(21)
      expect(r.quantity.unit).toBe('in')
    }
  })
})

// ─── F5: longest-first phrase sorting + trailing phrases ────────────────────

describe('F5: approximatePhrases longest-first + trailing variants', () => {
  it('"mas o menos 5 kg" parses as approx (not partial match on "mas")', () => {
    const r = qty('mas o menos 5 kg', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(5)
      expect(r.quantity.approximate).toBe(true)
    }
  })

  it('"5 kg mas o menos" trailing approx (ES)', () => {
    const r = qty('5 kg mas o menos', es)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(5)
      expect(r.quantity.approximate).toBe(true)
    }
  })

  it('"5 quilos mais ou menos" trailing approx (PT)', () => {
    const r = qty('5 quilos mais ou menos', pt)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.quantity.value).toBe(5)
      expect(r.quantity.approximate).toBe(true)
    }
  })
})
