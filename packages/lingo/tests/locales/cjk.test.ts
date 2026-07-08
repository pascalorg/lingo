import { describe, expect, it } from 'vitest'
import { parseDate } from '../../src/date/index'
import { createLingo } from '../../src/index'
import { ja } from '../../src/locales/ja'
import { zh } from '../../src/locales/zh'

const NOW = new Date(2026, 6, 8, 12)

describe('CJK locale packs', () => {
  it('does not parse CJK temperature words without a CJK pack', () => {
    const lingo = createLingo()
    const result = lingo.parse('暑い', { kind: 'temperature' })
    expect(result.ok).toBe(false)
  })

  it('parses Chinese compact quantities, dates, and fuzzy temperature', () => {
    const lingo = createLingo({ locales: [zh] })

    const quantity = lingo.parseQuantity('5公斤', { locale: 'zh' })
    expect(quantity.ok, JSON.stringify(quantity.issues)).toBe(true)
    if (quantity.ok) {
      expect(quantity.locale).toBe('zh')
      expect(quantity.quantity.unit).toBe('kg')
      expect(quantity.quantity.value).toBe(5)
    }

    const date = parseDate('三天前', { now: NOW, locale: 'zh', localePacks: [zh] })
    expect(date.ok, JSON.stringify(date.issues)).toBe(true)
    if (date.ok) {
      expect(date.date.getDate()).toBe(5)
      expect(date.grain).toBe('day')
    }

    const noonTomorrow = parseDate('明天中午', { now: NOW, locale: 'zh', localePacks: [zh] })
    expect(noonTomorrow.ok, JSON.stringify(noonTomorrow.issues)).toBe(true)
    if (noonTomorrow.ok) {
      expect(noonTomorrow.date).toEqual(new Date(2026, 6, 9, 12))
      expect(noonTomorrow.grain).toBe('hour')
    }

    const nextMonth = parseDate('下个月', { now: NOW, locale: 'zh', localePacks: [zh] })
    expect(nextMonth.ok, JSON.stringify(nextMonth.issues)).toBe(true)
    if (nextMonth.ok) {
      expect(nextMonth.date).toEqual(new Date(2026, 7, 1))
      expect(nextMonth.grain).toBe('month')
    }

    const fuzzy = lingo.parse('很热', { kind: 'temperature', locale: 'zh' })
    expect(fuzzy.ok, JSON.stringify(fuzzy.issues)).toBe(true)
    if (fuzzy.ok) {
      expect(fuzzy.locale).toBe('zh')
      expect(fuzzy.type).toBe('range')
      if (fuzzy.type === 'range') {
        expect(fuzzy.range.fuzzy?.term).toBe('很热')
      }
    }
  })

  it('parses Japanese compact quantities, dates, and fuzzy temperature', () => {
    const lingo = createLingo({ locales: [ja] })

    const quantity = lingo.parseQuantity('5キロ', { locale: 'ja' })
    expect(quantity.ok, JSON.stringify(quantity.issues)).toBe(true)
    if (quantity.ok) {
      expect(quantity.locale).toBe('ja')
      expect(quantity.quantity.unit).toBe('kg')
      expect(quantity.quantity.value).toBe(5)
    }

    const date = parseDate('3日前', { now: NOW, locale: 'ja', localePacks: [ja] })
    expect(date.ok, JSON.stringify(date.issues)).toBe(true)
    if (date.ok) {
      expect(date.date.getDate()).toBe(5)
      expect(date.grain).toBe('day')
    }

    const noonTomorrow = parseDate('明日の正午', { now: NOW, locale: 'ja', localePacks: [ja] })
    expect(noonTomorrow.ok, JSON.stringify(noonTomorrow.issues)).toBe(true)
    if (noonTomorrow.ok) {
      expect(noonTomorrow.date).toEqual(new Date(2026, 6, 9, 12))
      expect(noonTomorrow.grain).toBe('hour')
    }

    const nextMonth = parseDate('来月', { now: NOW, locale: 'ja', localePacks: [ja] })
    expect(nextMonth.ok, JSON.stringify(nextMonth.issues)).toBe(true)
    if (nextMonth.ok) {
      expect(nextMonth.date).toEqual(new Date(2026, 7, 1))
      expect(nextMonth.grain).toBe('month')
    }

    const fuzzy = lingo.parse('暑い', { kind: 'temperature', locale: 'ja' })
    expect(fuzzy.ok, JSON.stringify(fuzzy.issues)).toBe(true)
    if (fuzzy.ok) {
      expect(fuzzy.locale).toBe('ja')
      expect(fuzzy.type).toBe('range')
      if (fuzzy.type === 'range') {
        expect(fuzzy.range.fuzzy?.term).toBe('暑い')
      }
    }
  })

  it('pins bare CJK noon to today like English "noon"', () => {
    // An afternoon `now`: an unpinned noon would forward-roll to tomorrow.
    const afternoon = new Date(2026, 6, 8, 15)
    const zhNoon = parseDate('中午', { now: afternoon, locale: 'zh', localePacks: [zh] })
    expect(zhNoon.ok, JSON.stringify(zhNoon.ok ? '' : zhNoon.issues)).toBe(true)
    if (zhNoon.ok) {
      expect(zhNoon.date).toEqual(new Date(2026, 6, 8, 12))
    }
    const jaNoon = parseDate('正午', { now: afternoon, locale: 'ja', localePacks: [ja] })
    expect(jaNoon.ok, JSON.stringify(jaNoon.ok ? '' : jaNoon.issues)).toBe(true)
    if (jaNoon.ok) {
      expect(jaNoon.date).toEqual(new Date(2026, 6, 8, 12))
    }
  })
})
