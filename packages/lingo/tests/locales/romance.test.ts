import { describe, expect, it } from 'vitest'
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

  it('parses French quantities, ranges, and relative dates', () => {
    expectQuantity('deux kg', 'fr', 2)
    expectRange('entre 5 et 10 kg', 'fr', 5, 10)
    expectDate('il y a trois jours', 'fr', 5)
    expectDate('demain', 'fr', 9)
  })

  it('parses Portuguese quantities, ranges, and relative dates', () => {
    expectQuantity('dois kg', 'pt', 2)
    expectRange('entre 5 e 10 kg', 'pt', 5, 10)
    expectDate('há três dias', 'pt', 5)
    expectDate('amanhã', 'pt', 9)
  })
})
