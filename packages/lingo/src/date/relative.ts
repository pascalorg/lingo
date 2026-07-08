import type { LingoIssue } from '../core/types'
import { parseValue } from '../number/value'
import { parseAndFractionTail } from '../number/words'
import type { Token } from '../parse/tokenize'
import { monthDayCore, parseAbsolute } from './absolute'
import {
  addCalendar,
  backwardDiff,
  closestWeekdayDiff,
  dateInWeek,
  forwardDiff,
  sameDay,
  startOfDay,
  startOfWeek,
  withTime,
} from './civil'
import type { DateAlternative, DateGrain } from './parse'
import { type CoreDate, core, issue, knownFor, needsNow, type P, trimRange } from './state'
import {
  MONTHS as EN_MONTHS,
  SUBUNIT as EN_SUBUNIT,
  UNIT_WORDS as EN_UNIT_WORDS,
  WEEKDAY_NAMES as EN_WEEKDAY_NAMES,
  WEEKDAYS as EN_WEEKDAYS,
  type OffsetUnit,
} from './vocab'

interface OffsetPart {
  unit: OffsetUnit
  value: number
}

export function parseDateOnly(
  p: P,
  start: number,
  end: number,
  allowOffset: boolean,
): CoreDate | null {
  const { start: trimStart, end: trimEnd } = trimRange(p.text, start, end)
  if (trimStart === trimEnd) {
    return null
  }
  const source = p.text.slice(trimStart, trimEnd)
  const lower = source.toLowerCase()

  if (lower.startsWith('on ')) {
    const rest = parseDateOnly(p, trimStart + 3, trimEnd, allowOffset)
    if (rest) {
      return { ...rest, normStart: trimStart, normEnd: trimEnd }
    }
  }

  if (allowOffset) {
    const offset = parseOffset(p, trimStart, trimEnd)
    if (offset) {
      return offset
    }
  }

  const deictic = parseDeictic(p, trimStart, trimEnd)
  if (deictic) {
    return needsNow(deictic)
  }
  const weekday = parseWeekday(p, trimStart, trimEnd)
  if (weekday) {
    return needsNow(weekday)
  }
  const period = parseCalendarPeriod(p, trimStart, trimEnd)
  if (period) {
    return needsNow(period)
  }
  return parseAbsolute(p, trimStart, trimEnd)
}

function parseDeictic(p: P, start: number, end: number): CoreDate | null {
  const raw = p.text.slice(start, end).toLowerCase()
  const source = raw.endsWith('.') ? raw.slice(0, -1) : raw
  const today = startOfDay(p.now)
  const exactNow = ['now', 'right now', 'just now', 'a moment ago']
  if (exactNow.includes(source)) {
    return core(new Date(p.now.getTime()), 'second', knownFor('second'), start, end)
  }
  if (source === 'today') {
    return core(today, 'day', knownFor('day'), start, end)
  }
  const localeDayOffset = deicticDayOffset(p, source)
  if (localeDayOffset !== null) {
    return core(addCalendar(today, { days: localeDayOffset }), 'day', knownFor('day'), start, end)
  }
  if (source === 'tonight' || source === 'tonite') {
    return core(withTime(today, 22), 'hour', [...knownFor('hour'), 'implied-hour'], start, end)
  }
  if (source === 'tomorrow' || source === 'tmr' || source === 'tmrw') {
    return core(addCalendar(today, { days: 1 }), 'day', knownFor('day'), start, end)
  }
  if (source === 'yesterday' || source === 'yday' || source === "y'day") {
    return core(addCalendar(today, { days: -1 }), 'day', knownFor('day'), start, end)
  }
  if (source === 'day after tomorrow' || source === 'overmorrow') {
    return core(addCalendar(today, { days: 2 }), 'day', knownFor('day'), start, end)
  }
  if (source === 'day before yesterday') {
    return core(addCalendar(today, { days: -2 }), 'day', knownFor('day'), start, end)
  }
  if (source === 'this morning') {
    return core(withTime(today, 9), 'hour', [...knownFor('hour'), 'implied-hour'], start, end)
  }
  if (source === 'this afternoon') {
    return core(withTime(today, 15), 'hour', [...knownFor('hour'), 'implied-hour'], start, end)
  }
  if (source === 'this evening') {
    return core(withTime(today, 19), 'hour', [...knownFor('hour'), 'implied-hour'], start, end)
  }
  if (source === 'noon') {
    return core(withTime(today, 12), 'hour', knownFor('hour'), start, end)
  }
  if (source === 'midnight') {
    const date = withTime(addCalendar(today, { days: p.now.getHours() > 2 ? 1 : 0 }), 0)
    const issues =
      p.now.getHours() > 2 ? [issue(p, 'UNIT_ASSUMED', { unit: 'next day' }, start, end)] : []
    return core(date, 'hour', [...knownFor('hour'), 'implied-day'], start, end, issues)
  }
  if (source === 'last night') {
    const date =
      p.now.getHours() < 6 ? withTime(today, 0) : withTime(addCalendar(today, { days: -1 }), 22)
    return core(date, 'hour', [...knownFor('hour'), 'implied-day'], start, end)
  }
  return null
}

function parseOffset(p: P, start: number, end: number): CoreDate | null {
  const first = tokenIndexAt(p, start, end)
  const last = tokenIndexBefore(p, end)
  if (first < 0 || last < first) {
    return null
  }
  const compact = parseCompactLocaleOffset(p, start, end)
  if (compact) {
    return needsNow(compact)
  }
  const pastPrefixEnd = eatPastPrefix(p, first)
  if (pastPrefixEnd > first) {
    const parts = parseOffsetParts(p, pastPrefixEnd, last + 1)
    if (parts && parts.next === last + 1) {
      return needsNow(offsetCore(p, p.now, parts.parts, -1, start, end))
    }
  }
  if (wordAt(p, first) === 'in') {
    const parts = parseOffsetParts(p, first + 1, last + 1)
    if (parts && parts.next === last + 1) {
      return needsNow(offsetCore(p, p.now, parts.parts, 1, start, end))
    }
  }

  const parts = parseOffsetParts(p, first, last + 1)
  if (!parts) {
    return null
  }
  const nextWord = wordAt(p, parts.next)
  if (nextWord === 'ago' && parts.next === last) {
    return needsNow(offsetCore(p, p.now, parts.parts, -1, start, end))
  }
  if (nextWord === 'from' && wordAt(p, parts.next + 1) === 'now' && parts.next + 1 === last) {
    return needsNow(offsetCore(p, p.now, parts.parts, 1, start, end))
  }
  if (nextWord === 'from' || nextWord === 'after') {
    const anchorStart = p.tokens[parts.next + 1]?.start
    if (anchorStart === undefined) {
      return null
    }
    const anchor = parseDateOnly(p, anchorStart, end, false)
    if (anchor) {
      const date = anchor.date
      let borrowedTime = false
      if (
        !anchor.known.includes('hour') &&
        parts.parts.some(
          (part) => part.unit === 'hour' || part.unit === 'minute' || part.unit === 'second',
        )
      ) {
        date.setHours(p.now.getHours(), p.now.getMinutes())
        borrowedTime = true
      }
      const offset = offsetCore(p, date, parts.parts, 1, start, end)
      return anchor.ref || borrowedTime ? needsNow(offset) : offset
    }
  }
  return null
}

function parseOffsetParts(
  p: P,
  startToken: number,
  endToken: number,
): { parts: OffsetPart[]; next: number } | null {
  const parts: OffsetPart[] = []
  let pos = startToken
  while (pos < endToken) {
    const value = parseValue(
      {
        tokens: p.tokens,
        n: p.n,
        src: p.src,
        numberFormat: p.profile.defaults.numberFormat ?? 'auto',
        kind: 'duration',
        numberWords: true,
        profile: p.profile,
      },
      pos,
      pos === startToken,
    )
    if (!value) {
      break
    }
    const unitToken = p.tokens[value.next]
    const unit = unitFromToken(p, unitToken)
    if (!unit) {
      const previous = parts[parts.length - 1]
      const subunit = previous ? dateSubunit(p)[previous.unit] : undefined
      if (previous && subunit && value.value >= 0 && value.value < subunitLimit(subunit)) {
        parts.push({ unit: subunit, value: value.value })
        pos = value.next
        continue
      }
      break
    }
    let partValue =
      unitToken?.text.toLowerCase() === 'fortnight' ||
      unitToken?.text.toLowerCase() === 'fortnights'
        ? value.value * 2
        : value.value
    pos = value.next + 1
    const tail = parseAndFractionTail(p.tokens, pos, p.profile.numberWords)
    if (tail) {
      partValue += tail.add
      pos = tail.next
    }
    parts.push({ unit, value: partValue })
    if (isJoinWord(p, pos)) {
      pos++
      continue
    }
    if (p.tokens[pos]?.type === 'sym' && p.tokens[pos]!.text === ',') {
      pos++
      continue
    }
    if (valueStarts(p, pos)) {
      continue
    }
    break
  }
  return parts.length > 0 ? { parts, next: pos } : null
}

function offsetCore(
  p: P,
  anchor: Date,
  parts: readonly OffsetPart[],
  direction: 1 | -1,
  start: number,
  end: number,
): CoreDate {
  const totals = { years: 0, months: 0, weeks: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  for (const part of parts) {
    const value = part.value * direction
    if (part.unit === 'year') {
      totals.years += value
    } else if (part.unit === 'month') {
      totals.months += value
    } else if (part.unit === 'week') {
      totals.weeks += value
    } else if (part.unit === 'day') {
      totals.days += value
    } else if (part.unit === 'hour') {
      totals.hours += value
    } else if (part.unit === 'minute') {
      totals.minutes += value
    } else {
      totals.seconds += value
    }
  }
  const date = addCalendar(anchor, totals)
  const grain = finestOffsetGrain(parts)
  return core(date, grain, knownFor(grain), start, end)
}

function parseWeekday(p: P, start: number, end: number): CoreDate | null {
  const source = p.text.slice(start, end).toLowerCase()
  const words = source.split(/\s+/)
  let modifier: 'bare' | 'this' | 'next' | 'last' = 'bare'
  let dayWord = words[0]
  if (words.length === 2 && (words[0] === 'this' || words[0] === 'next' || words[0] === 'last')) {
    modifier = words[0]
    dayWord = words[1]
  } else if (words.length !== 1) {
    return null
  }
  if (!dayWord) {
    return null
  }
  const weekday = dateWeekdays(p)[dayWord]
  if (weekday === undefined) {
    return null
  }
  const today = startOfDay(p.now)
  const issues: LingoIssue[] = []
  const alternatives: DateAlternative[] = []
  let date: Date
  if (modifier === 'this') {
    date = dateInWeek(startOfWeek(today, p.weekStart), weekday, p.weekStart)
  } else if (modifier === 'next') {
    date = dateInWeek(
      addCalendar(startOfWeek(today, p.weekStart), { days: 7 }),
      weekday,
      p.weekStart,
    )
    const soonest = addCalendar(today, { days: forwardDiff(today.getDay(), weekday) })
    if (!sameDay(date, soonest)) {
      alternatives.push({
        type: 'date',
        date: soonest,
        reason: 'soonest-occurrence',
        confidence: 0.45,
      })
    }
  } else if (modifier === 'last') {
    const diff = backwardDiff(today.getDay(), weekday) || 7
    date = addCalendar(today, { days: -diff })
  } else {
    const diff = p.forwardDates
      ? forwardDiff(today.getDay(), weekday)
      : closestWeekdayDiff(today.getDay(), weekday)
    date = addCalendar(today, { days: diff })
    issues.push(
      issue(p, 'WEEKDAY_ASSUMED_NEXT', { weekday: dateWeekdayNames(p)[weekday]! }, start, end),
    )
  }
  return core(date, 'day', [...knownFor('day'), 'weekday'], start, end, issues, alternatives)
}

function parseCalendarPeriod(p: P, start: number, end: number): CoreDate | null {
  const source = p.text.slice(start, end).toLowerCase()
  const rel = /^(this|next|last)\s+(week|month|year)$/.exec(source)
  if (rel) {
    const mod = rel[1] as 'this' | 'next' | 'last'
    const period = rel[2] as 'week' | 'month' | 'year'
    return periodCore(p, mod, period, start, end)
  }
  if (source === 'this weekend') {
    const today = startOfDay(p.now)
    return core(
      addCalendar(today, { days: forwardDiff(today.getDay(), 6) }),
      'day',
      knownFor('day'),
      start,
      end,
    )
  }
  const edge =
    /^(?:the\s+)?(beginning|start|end|middle|mid)(?:\s+of)?(?:\s+the)?(?:\s+(this|next|last))?\s+(.+)$/.exec(
      source,
    )
  if (edge) {
    const kind = edge[1]!
    const mod = (edge[2] as 'this' | 'next' | 'last' | undefined) ?? 'this'
    const target = edge[3]!
    if (target === 'week' || target === 'month' || target === 'year') {
      if (kind === 'middle' || kind === 'mid') {
        return middlePeriodCore(p, mod, target, start, end)
      }
      const base = periodCore(p, mod, target, start, end)
      if (!base) {
        return null
      }
      if (kind === 'end') {
        return endPeriodCore(p, base.date, target, start, end)
      }
      return base
    }
    const month = dateMonths(p)[target]
    if (month !== undefined && (kind === 'middle' || kind === 'mid')) {
      return monthDayCore(p, month, 15, undefined, 'day', start, end)
    }
  }
  const mid = /^mid-?\s*([a-z]+)$/.exec(source)
  if (mid) {
    const month = dateMonths(p)[mid[1]!]
    if (month !== undefined) {
      return monthDayCore(p, month, 15, undefined, 'day', start, end)
    }
  }
  return null
}

function periodCore(
  p: P,
  mod: 'this' | 'next' | 'last',
  period: 'week' | 'month' | 'year',
  start: number,
  end: number,
): CoreDate {
  const delta = mod === 'next' ? 1 : mod === 'last' ? -1 : 0
  let date: Date
  if (period === 'week') {
    date = addCalendar(startOfWeek(p.now, p.weekStart), { days: delta * 7 })
  } else if (period === 'month') {
    date = new Date(p.now.getFullYear(), p.now.getMonth() + delta, 1)
  } else {
    date = new Date(p.now.getFullYear() + delta, 0, 1)
  }
  return core(date, period, knownFor(period), start, end)
}

function middlePeriodCore(
  p: P,
  mod: 'this' | 'next' | 'last',
  period: 'week' | 'month' | 'year',
  start: number,
  end: number,
): CoreDate {
  const base = periodCore(p, mod, period, start, end).date
  if (period === 'week') {
    return core(addCalendar(base, { days: 3 }), 'day', knownFor('day'), start, end)
  }
  if (period === 'month') {
    return core(
      new Date(base.getFullYear(), base.getMonth(), 15),
      'day',
      knownFor('day'),
      start,
      end,
    )
  }
  return core(new Date(base.getFullYear(), 6, 2), 'day', knownFor('day'), start, end)
}

function endPeriodCore(
  p: P,
  base: Date,
  period: 'week' | 'month' | 'year',
  start: number,
  end: number,
): CoreDate {
  if (period === 'week') {
    return core(addCalendar(base, { days: 6 }), 'day', knownFor('day'), start, end)
  }
  if (period === 'month') {
    return core(
      new Date(base.getFullYear(), base.getMonth() + 1, 0),
      'day',
      knownFor('day'),
      start,
      end,
    )
  }
  return core(new Date(base.getFullYear(), 11, 31), 'day', knownFor('day'), start, end)
}

function wordAt(p: P, i: number): string | null {
  const t = p.tokens[i]
  return t?.type === 'word' ? t.text.toLowerCase() : null
}

function tokenIndexAt(p: P, start: number, end: number): number {
  return p.tokens.findIndex((token) => token.start >= start && token.end <= end)
}

function tokenIndexBefore(p: P, end: number): number {
  for (let i = p.tokens.length - 1; i >= 0; i--) {
    if (p.tokens[i]!.end <= end) {
      return i
    }
  }
  return -1
}

function unitFromToken(p: P, token: Token | undefined): OffsetUnit | null {
  if (token?.type !== 'word') {
    return null
  }
  return dateUnitWords(p)[token.text.toLowerCase()] ?? null
}

function valueStarts(p: P, i: number): boolean {
  const t = p.tokens[i]
  if (!t) {
    return false
  }
  if (t.type === 'digits' || t.type === 'vulgar') {
    return true
  }
  if (t.type === 'sym' && (t.text === '-' || t.text === '+' || t.text === '.')) {
    return true
  }
  if (t.type === 'word') {
    return (
      parseValue(
        {
          tokens: p.tokens,
          n: p.n,
          src: p.src,
          numberFormat: p.profile.defaults.numberFormat ?? 'auto',
          kind: 'duration',
          numberWords: true,
          profile: p.profile,
        },
        i,
      ) !== null
    )
  }
  return false
}

function dateMonths(p: P): Record<string, number> {
  return p.profile.date?.months ?? EN_MONTHS
}

function dateSubunit(p: P): Partial<Record<OffsetUnit, OffsetUnit>> {
  return (p.profile.date?.subunit ?? EN_SUBUNIT) as Partial<Record<OffsetUnit, OffsetUnit>>
}

function dateUnitWords(p: P): Record<string, OffsetUnit> {
  return (p.profile.date?.unitWords ?? EN_UNIT_WORDS) as Record<string, OffsetUnit>
}

function dateWeekdayNames(p: P): readonly string[] {
  return p.profile.date?.weekdayNames ?? EN_WEEKDAY_NAMES
}

function dateWeekdays(p: P): Record<string, number> {
  return p.profile.date?.weekdays ?? EN_WEEKDAYS
}

function deicticDayOffset(p: P, source: string): number | null {
  if (p.profile.locale === 'es' && source === 'manana') {
    return 1
  }
  if (p.profile.locale === 'fr' && source === 'demain') {
    return 1
  }
  if (p.profile.locale === 'pt' && source === 'amanha') {
    return 1
  }
  return null
}

function eatPastPrefix(p: P, first: number): number {
  if (p.profile.locale === 'es' && wordAt(p, first) === 'hace') {
    return first + 1
  }
  if (p.profile.locale === 'pt' && wordAt(p, first) === 'ha') {
    return first + 1
  }
  if (
    p.profile.locale === 'fr' &&
    wordAt(p, first) === 'il' &&
    wordAt(p, first + 1) === 'y' &&
    wordAt(p, first + 2) === 'a'
  ) {
    return first + 3
  }
  return first
}

function parseCompactLocaleOffset(p: P, start: number, end: number): CoreDate | null {
  const source = p.text.slice(start, end)
  const locale = p.profile.locale
  const zh =
    locale === 'zh'
      ? /^([0-9零〇一二两三四五六七八九十]+)(秒|分钟|分|小时|天|日|周|星期|个月|月|年)(前|后)$/.exec(
          source,
        )
      : null
  const ja =
    locale === 'ja'
      ? /^([0-9零〇一二三四五六七八九十]+)(秒|分|時間|日|週間|週|ヶ月|か月|月|年)(前|後)$/.exec(
          source,
        )
      : null
  const m = zh ?? ja
  if (!m) {
    return null
  }
  const value = parseCompactNumber(p, m[1]!)
  const unit = compactUnit(m[2]!)
  if (value === null || !unit) {
    return null
  }
  const direction = m[3] === '前' ? -1 : 1
  return offsetCore(p, p.now, [{ unit, value }], direction, start, end)
}

function parseCompactNumber(p: P, text: string): number | null {
  if (/^\d+$/.test(text)) {
    return Number(text)
  }
  if (text === '十') {
    return 10
  }
  const ten = text.indexOf('十')
  if (ten >= 0) {
    const left = ten === 0 ? 1 : (p.profile.numerals?.[text.slice(0, ten)] ?? Number.NaN)
    const right =
      ten === text.length - 1 ? 0 : (p.profile.numerals?.[text.slice(ten + 1)] ?? Number.NaN)
    const value = left * 10 + right
    return Number.isFinite(value) ? value : null
  }
  const value = p.profile.numerals?.[text]
  return value === undefined ? null : value
}

function compactUnit(text: string): OffsetUnit | null {
  if (text === '秒') {
    return 'second'
  }
  if (text === '分钟' || text === '分') {
    return 'minute'
  }
  if (text === '小时' || text === '時間') {
    return 'hour'
  }
  if (text === '天' || text === '日') {
    return 'day'
  }
  if (text === '周' || text === '星期' || text === '週間' || text === '週') {
    return 'week'
  }
  if (text === '个月' || text === 'ヶ月' || text === 'か月' || text === '月') {
    return 'month'
  }
  return text === '年' ? 'year' : null
}

function isJoinWord(p: P, pos: number): boolean {
  const w = wordAt(p, pos)
  return w !== null && p.profile.numberWords.andWords.has(w)
}

function subunitLimit(unit: OffsetUnit): number {
  if (unit === 'second' || unit === 'minute') {
    return 60
  }
  if (unit === 'hour') {
    return 24
  }
  if (unit === 'day') {
    return 7
  }
  return Number.POSITIVE_INFINITY
}

function finestOffsetGrain(parts: readonly OffsetPart[]): DateGrain {
  const order: OffsetUnit[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second']
  let finest = 'year' as OffsetUnit
  for (const part of parts) {
    if (order.indexOf(part.unit) > order.indexOf(finest)) {
      finest = part.unit
    }
  }
  return finest === 'week' ? 'day' : finest
}
