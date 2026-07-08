import { describe, expect, it } from 'vitest'
import type { DateGrain } from '../../src/date/index'
import { parseDate } from '../../src/date/index'
import { createLingo } from '../../src/index'
import { es } from '../../src/locales/es'
import { fr } from '../../src/locales/fr'
import { pt } from '../../src/locales/pt'

const NOW = new Date(2026, 6, 8, 12)

function expectQuantity(input: string, locale: 'es' | 'fr' | 'pt', value: number) {
  const packs = { es, fr, pt }
  const lingo = createLingo({ locales: [packs[locale]] })
  const result = lingo.parseQuantity(input, { locale })
  expect(result.ok, JSON.stringify(result.issues)).toBe(true)
  if (result.ok) {
    expect(result.locale).toBe(locale)
    expect(result.quantity.kind).toBe('mass')
    expect(result.quantity.unit).toBe('kg')
    expect(result.quantity.value).toBe(value)
  }
}

function expectRange(input: string, locale: 'es' | 'fr' | 'pt', min: number, max: number) {
  const packs = { es, fr, pt }
  const lingo = createLingo({ locales: [packs[locale]] })
  const result = lingo.parseRange(input, { locale })
  expect(result.ok, JSON.stringify(result.issues)).toBe(true)
  if (result.ok) {
    expect(result.locale).toBe(locale)
    expect(result.range.min()?.value).toBe(min)
    expect(result.range.max()?.value).toBe(max)
    expect(result.range.min()?.unit).toBe('kg')
  }
}

function expectDate(input: string, locale: 'es' | 'fr' | 'pt', day: number) {
  const packs = { es, fr, pt }
  const result = parseDate(input, { now: NOW, locale, localePacks: [packs[locale]] })
  expect(result.ok, JSON.stringify(result.issues)).toBe(true)
  if (result.ok) {
    expect(result.date.getFullYear()).toBe(2026)
    expect(result.date.getMonth()).toBe(6)
    expect(result.date.getDate()).toBe(day)
    expect(result.grain).toBe('day')
  }
}

function expectDateTime(
  input: string,
  locale: 'es' | 'fr' | 'pt',
  expected: Date,
  grain: DateGrain = 'day',
) {
  const packs = { es, fr, pt }
  const result = parseDate(input, { now: NOW, locale, localePacks: [packs[locale]] })
  expect(result.ok, `${input}: ${JSON.stringify(result.issues)}`).toBe(true)
  if (!result.ok) {
    return
  }
  expect(result.date).toEqual(expected)
  expect(result.grain).toBe(grain)
  expect(result.span).toEqual({ start: 0, end: input.length })

  const canonical = parseDate(dayIso(result.date), {
    now: NOW,
    locale,
    localePacks: [packs[locale]],
  })
  expect(canonical.ok, `${input} canonical round-trip`).toBe(true)
  if (canonical.ok) {
    expect(canonical.date).toEqual(
      new Date(result.date.getFullYear(), result.date.getMonth(), result.date.getDate()),
    )
  }
}

describe('Romance locale packs', () => {
  it('parses Spanish quantities, ranges, bounds, and relative dates', () => {
    expectQuantity('dos kg', 'es', 2)
    expectRange('entre 5 y 10 kg', 'es', 5, 10)

    const lingo = createLingo({ locales: [es] })
    const bounded = lingo.parseRange('al menos 2 m', { locale: 'es' })
    expect(bounded.ok, JSON.stringify(bounded.issues)).toBe(true)
    if (bounded.ok) {
      expect(bounded.range.min()?.value).toBe(2)
      expect(bounded.range.min()?.unit).toBe('m')
    }

    expectDate('hace tres dias', 'es', 5)
    expectDate('mañana', 'es', 9)
  })

  it('parses Spanish date/time phrases with an explicit mañana policy', () => {
    expectDateTime('en la mañana', 'es', new Date(2026, 6, 9, 9), 'hour')
    expectDateTime('por la mañana', 'es', new Date(2026, 6, 9, 9), 'hour')
    expectDateTime('mañana', 'es', new Date(2026, 6, 9), 'day')
    expectDateTime('mañana por la mañana', 'es', new Date(2026, 6, 9, 9), 'hour')
    expectDateTime('mediodía mañana', 'es', new Date(2026, 6, 9, 12), 'hour')
    expectDateTime('el mes que viene', 'es', new Date(2026, 7, 1), 'month')
    expectDateTime('el próximo mes', 'es', new Date(2026, 7, 1), 'month')
    expectDateTime('12 de julio de 2026', 'es', new Date(2026, 6, 12), 'day')
    expectDateTime('hace 3 días', 'es', new Date(2026, 6, 5, 12), 'day')
  })

  it('parses French quantities, ranges, and relative dates', () => {
    expectQuantity('deux kg', 'fr', 2)
    expectRange('entre 5 et 10 kg', 'fr', 5, 10)
    expectDate('il y a trois jours', 'fr', 5)
    expectDate('demain', 'fr', 9)
  })

  it('parses French date/time phrases', () => {
    expectDateTime('midi demain', 'fr', new Date(2026, 6, 9, 12), 'hour')
    expectDateTime('demain matin', 'fr', new Date(2026, 6, 9, 9), 'hour')
    expectDateTime('demain', 'fr', new Date(2026, 6, 9), 'day')
    expectDateTime('le mois prochain', 'fr', new Date(2026, 7, 1), 'month')
    expectDateTime('dans 3 jours', 'fr', new Date(2026, 6, 11, 12), 'day')
    expectDateTime('12 juillet 2026', 'fr', new Date(2026, 6, 12), 'day')
    expectDateTime('juillet dernier', 'fr', new Date(2025, 6, 1), 'month')
  })

  it('parses Portuguese quantities, ranges, and relative dates', () => {
    expectQuantity('dois kg', 'pt', 2)
    expectRange('entre 5 e 10 kg', 'pt', 5, 10)
    expectDate('há três dias', 'pt', 5)
    expectDate('amanhã', 'pt', 9)
  })

  it('parses Portuguese date/time phrases', () => {
    expectDateTime('amanhã de manhã', 'pt', new Date(2026, 6, 9, 9), 'hour')
    expectDateTime('meio-dia amanhã', 'pt', new Date(2026, 6, 9, 12), 'hour')
    expectDateTime('mês que vem', 'pt', new Date(2026, 7, 1), 'month')
    expectDateTime('12 de julho', 'pt', new Date(2026, 6, 12), 'day')
  })

  it('pins bare midday to today like English "noon"; midnight still rolls forward', () => {
    // An afternoon `now`: an unpinned midday would forward-roll to tomorrow.
    const afternoon = new Date(2026, 6, 8, 15)
    const packs = { es, fr, pt }
    const at = (input: string, locale: 'es' | 'fr' | 'pt') => {
      const r = parseDate(input, { now: afternoon, locale, localePacks: [packs[locale]] })
      expect(r.ok, `${input}: ${r.ok ? '' : JSON.stringify(r.issues)}`).toBe(true)
      return r.ok ? r.date : undefined
    }
    // Noon carries dayOffset: 0, matching English `noon` — stays on today.
    expect(at('mediodía', 'es')).toEqual(new Date(2026, 6, 8, 12))
    expect(at('midi', 'fr')).toEqual(new Date(2026, 6, 8, 12))
    expect(at('meio-dia', 'pt')).toEqual(new Date(2026, 6, 8, 12))
    expect(at('meio dia', 'pt')).toEqual(new Date(2026, 6, 8, 12))
    // Midnight has no pin — like English `midnight`, it rolls to the next 00:00.
    expect(at('minuit', 'fr')).toEqual(new Date(2026, 6, 9, 0))
  })
})

function dayIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
