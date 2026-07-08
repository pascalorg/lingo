import { makeIssue } from '../core/errors'
import type { IssueCode, IssueInputData, LingoIssue, Messages, Severity, Span } from '../core/types'
import { isLocaleLoaded, resolveLanguageProfile } from '../locale/profile'
import type { LocalePack } from '../locale/types'
import { normalizeInput, toSourceSpan } from '../parse/normalize'
import type { SerializedResult } from '../parse/serialize'
import { tokenize } from '../parse/tokenize'
import { addCalendar } from './civil'
import {
  type Endpoint,
  endpointDate,
  finishRange,
  inferMeridiem,
  parseRangeEndpoint,
  RANGE_SPLITS,
  rollDay,
} from './range'
import { parseDateOnly } from './relative'
import {
  attachDateRangeSerialization,
  attachDateSerialization,
  type SerializedDate,
  type SerializedDateFailure,
  type SerializedDateRange,
} from './serialize'
import { type CoreDate, confidence, issue, knownFor, type P, trimRange } from './state'
import { parseTimeOnly, type TimeCore } from './time'
import { TIME_PATTERN } from './vocab'
import { applyZoneToCivil, type DateZone, stripTrailingZone } from './zone'

/**
 * How precisely a parsed date was specified — "2026" is `'year'` grain,
 * "3pm" is `'minute'`. Drives `DateResult.known` and `humanizeDate`'s
 * `maxUnit`/`minUnit`.
 * @example
 * ```ts
 * import { parseDate } from '@pascal-app/lingo/date'
 * const r = parseDate('tomorrow', { now: new Date('2026-07-03') })
 * r.ok && r.grain // 'day'
 * ```
 */
export type DateGrain = 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second'

/**
 * Options for `parseDate()`.
 * @example
 * ```ts
 * import { parseDate } from '@pascal-app/lingo/date'
 * parseDate('5/3', { dayFirst: true }) // March 5 — dayFirst flips the numeric-date reading
 * ```
 */
export interface DateOptions {
  /** Resolve a detected timezone to a real UTC instant (default: expose it, keep civil time). */
  applyZone?: boolean
  dayFirst?: boolean
  escalate?: Partial<Record<IssueCode, Severity>>
  forwardDates?: boolean
  locale?: string
  localePacks?: readonly LocalePack[]
  messages?: Messages
  now?: Date
  strictness?: 'forgiving' | 'confirm' | 'strict'
  weekStart?: number
}

/**
 * A successfully parsed date. `known` lists the calendar fields the parse
 * pinned down (`'year'`, `'month'`, `'day'`, `'hour'`…) plus marker entries
 * — `'implied-hour'`, `'implied-day'`, `'weekday'` — when a field was filled
 * by convention rather than stated ("tonight" implies 22:00).
 * @example
 * ```ts
 * import { parseDate } from '@pascal-app/lingo/date'
 * const r = parseDate('tonight', { now: new Date('2026-07-03T10:00:00') })
 * r.ok && r.known // ['year', 'month', 'day', 'hour', 'implied-hour']
 * ```
 */
export interface DateResult {
  alternatives?: DateAlternative[]
  confidence: number
  date: Date
  grain: DateGrain
  issues: LingoIssue[]
  known: string[]
  ok: true
  span: Span
  text: string
  /** v3 wire shape (ISO date, self-describing spans) — what `JSON.stringify` emits. */
  toJSON?(): SerializedDate
  type: 'date'
  /** Timezone detected in the input, when any (see `applyZone`). */
  zone?: DateZone
}

/**
 * `ok: false` from `parseDate()`/`parseDuration()`. Date inputs that depend
 * on a reference time ("tomorrow", "March 5", "at 3pm") fail with
 * `NOW_REQUIRED` unless `now` is passed explicitly.
 * @example
 * ```ts
 * import { parseDate } from '@pascal-app/lingo/date'
 * const r = parseDate('in 2 days') // no `now` passed
 * !r.ok && r.issues[0].code // 'NOW_REQUIRED'
 * ```
 */
export interface DateFail<T = unknown> {
  candidate?: T
  issues: LingoIssue[]
  ok: false
  text: string
  /**
   * v3 wire shape (self-describing spans) — what `JSON.stringify` emits.
   * `parseDuration`'s unit-expression path can fail with a core grammar
   * failure, hence the union.
   */
  toJSON?(): SerializedDateFailure | SerializedResult
}

export interface DateAlternative {
  confidence: number
  date: Date
  reason: string
  type: 'date'
}

/**
 * When `now` is omitted, parsing runs against this fixed anchor — never the
 * host clock — so results stay deterministic. Reference-dependent inputs
 * ("tomorrow") don't silently resolve against it: they fail with
 * NOW_REQUIRED before the anchor can matter. Only anchor-independent parses
 * (full absolute dates) succeed without `now`.
 */
function anchorNow(): Date {
  return new Date(2000, 0, 1, 12)
}

/**
 * Parse a natural-language date: absolute ("2026-07-04", "March 5"), relative
 * ("in 2 days", "tomorrow", "three days ago"), or weekday/period phrases
 * ("next tuesday", "end of this month"). Inputs that need a reference time
 * require an explicit `now` (they fail with NOW_REQUIRED otherwise — the
 * host clock is never read); full absolute dates ("2026-07-04") do not.
 * @example
 * ```ts
 * import { parseDate } from '@pascal-app/lingo/date'
 * const now = new Date('2026-07-03T10:00:00')
 * const r = parseDate('tomorrow', { now })
 * r.ok && r.date.getDate() // 4 (midnight the next calendar day, as a Date)
 * ```
 */
export function parseDate(text: string, opts?: DateOptions): DateResult | DateFail<DateResult> {
  return attachDateSerialization(parseDateImpl(text, opts))
}

function parseDateImpl(text: string, opts?: DateOptions): DateResult | DateFail<DateResult> {
  const now = opts?.now === undefined ? anchorNow() : new Date(opts.now.getTime())
  const n = normalizeInput(text)
  const localeNotLoaded =
    opts?.locale !== undefined && !isLocaleLoaded(opts.localePacks, opts.locale)
      ? makeIssue(
          'LOCALE_NOT_LOADED',
          { locale: opts.locale },
          toSourceSpan(n, 0, n.text.length),
          opts.messages,
        )
      : undefined
  const p: P = {
    src: text,
    n,
    text: n.text,
    tokens: tokenize(n),
    now,
    opts: opts ?? {},
    profile: resolveLanguageProfile(opts?.localePacks, localeNotLoaded ? 'en' : opts?.locale),
    weekStart: normalizeWeekStart(opts?.weekStart),
    forwardDates: opts?.forwardDates ?? true,
    escalate: dateEscalate(opts),
  }
  if (localeNotLoaded) {
    return { ok: false, text: p.src, issues: [localeNotLoaded] }
  }
  const { start, end } = trimRange(n.text, 0, n.text.length)
  if (start === end) {
    return fail(p, 'NO_VALUE', { example: '"tomorrow"' }, start, end)
  }
  const parsed = parseWithOptionalTime(p, start, end)
  if (parsed) {
    return ok(p, parsed)
  }
  const loneNumber = /^\d+$/.test(n.text.slice(start, end))
  return fail(
    p,
    loneNumber ? 'NO_VALUE' : 'UNSUPPORTED_DATE',
    { example: '"tomorrow" or "2026-07-03"' },
    start,
    end,
  )
}

function dateEscalate(opts: DateOptions | undefined): Partial<Record<IssueCode, Severity>> {
  const out: Partial<Record<IssueCode, Severity>> = {}
  if (opts?.strictness === 'confirm' || opts?.strictness === 'strict') {
    out.AMBIGUOUS_DATE = 'error'
    out.WEEKDAY_ASSUMED_NEXT = 'error'
  }
  return Object.assign(out, opts?.escalate)
}

function parseWithOptionalTime(p: P, start: number, end: number): CoreDate | null {
  const source = p.text.slice(start, end)
  const trailing = new RegExp(`^(.*?)(?:\\s+)?(${TIME_PATTERN})$`, 'i').exec(source)
  if (trailing?.[1] && trailing[2]) {
    const localTimeStart = source.length - trailing[2].length
    const { start: dateStart, end: dateEnd } = trimRange(p.text, start, start + trailing[1].length)
    const { start: timeStart, end: timeEnd } = trimRange(p.text, start + localTimeStart, end)
    if (dateStart < dateEnd) {
      const dateCore = parseDateOnly(p, dateStart, dateEnd, true)
      const timeCore = parseTimeOnly(p, timeStart, timeEnd)
      if (dateCore && timeCore) {
        return attachTime(dateCore, timeCore, start, end)
      }
    }
  }

  const leading = new RegExp(`^(${TIME_PATTERN})\\s+(?:on\\s+)?(.+)$`, 'i').exec(source)
  if (leading?.[1] && leading[2]) {
    const timeEnd = start + leading[1].length
    const dateStart = end - leading[2].length
    const timeCore = parseTimeOnly(p, start, timeEnd)
    const dateCore = parseDateOnly(p, dateStart, end, true)
    if (timeCore && dateCore) {
      return attachTime(dateCore, timeCore, start, end)
    }
  }

  const dateOnly = parseDateOnly(p, start, end, true)
  if (dateOnly) {
    return dateOnly
  }

  const timeOnly = parseTimeOnly(p, start, end)
  if (timeOnly) {
    let date = new Date(
      p.now.getFullYear(),
      p.now.getMonth(),
      p.now.getDate(),
      timeOnly.hour,
      timeOnly.minute,
      timeOnly.second,
    )
    if (p.forwardDates && date.getTime() < p.now.getTime()) {
      date = addCalendar(date, { days: 1 })
    }
    return {
      date,
      grain: timeOnly.grain,
      known: knownFor(timeOnly.grain),
      normStart: start,
      normEnd: end,
      issues: timeOnly.issues,
      ref: true,
      zone: timeOnly.zone,
    }
  }
  return null
}

function attachTime(core: CoreDate, time: TimeCore, start: number, end: number): CoreDate {
  const date = new Date(core.date.getTime())
  date.setHours(time.hour, time.minute, time.second, 0)
  return {
    date,
    grain: time.grain,
    known: mergeKnown(core.known, knownFor(time.grain)),
    normStart: start,
    normEnd: end,
    issues: [...core.issues, ...time.issues],
    ref: core.ref,
    alternatives: core.alternatives,
    zone: time.zone ?? core.zone,
  }
}

function ok(p: P, parsed: CoreDate): DateResult | DateFail<DateResult> {
  // `applyZone`: reinterpret the civil wall-clock fields in the detected zone to
  // get the real UTC instant. Otherwise the civil time is kept and `zone` is
  // exposed for the caller to apply.
  const date = parsed.zone?.applied ? applyZoneToCivil(parsed.date, parsed.zone) : parsed.date
  const result: DateResult = {
    ok: true,
    type: 'date',
    date,
    grain: parsed.grain,
    known: [...new Set(parsed.known)],
    span: toSourceSpan(p.n, parsed.normStart, parsed.normEnd),
    issues: parsed.issues,
    confidence: confidence(parsed.issues),
    text: p.src,
  }
  if (parsed.zone) {
    result.zone = parsed.zone
  }
  if (parsed.alternatives && parsed.alternatives.length > 0) {
    result.alternatives = parsed.alternatives
  }
  const issues = parsed.issues.map((it) => {
    const severity = p.escalate[it.code]
    return severity && severity !== it.severity ? { ...it, severity } : it
  })
  if (p.opts.now === undefined && parsed.ref) {
    return {
      ok: false,
      text: p.src,
      issues: [...issues, makeIssue('NOW_REQUIRED', {}, result.span, p.opts.messages)],
    }
  }
  return issues.some((it) => it.severity === 'error')
    ? { ok: false, text: p.src, issues, candidate: result }
    : { ...result, issues }
}

function fail<C extends 'NO_VALUE' | 'UNSUPPORTED_DATE'>(
  p: P,
  code: C,
  data: IssueInputData<C>,
  start: number,
  end: number,
): DateFail<DateResult> {
  return {
    ok: false,
    text: p.src,
    issues: [issue(p, code, data, start, end)],
  }
}

function mergeKnown(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])]
}

function normalizeWeekStart(value: number | undefined): number {
  if (value === undefined || !Number.isInteger(value)) {
    return 1
  }
  return ((value % 7) + 7) % 7
}

/** One endpoint of a time range/slot. */
export interface DateRangeEndpoint {
  date: Date
  grain: DateGrain
  known: string[]
  zone?: DateZone
}

/** A time range/slot from `parseDateRange()` — either or both ends may be open. */
export interface DateRange {
  confidence: number
  end?: DateRangeEndpoint
  issues: LingoIssue[]
  ok: true
  span: Span
  start?: DateRangeEndpoint
  text: string
  /** v3 wire shape (ISO endpoints, self-describing spans) — what `JSON.stringify` emits. */
  toJSON?(): SerializedDateRange
  type: 'date-range'
}

/** `ok: false` from `parseDateRange()`. */
export interface DateRangeFail {
  issues: LingoIssue[]
  ok: false
  text: string
  /** v3 wire shape (self-describing spans) — what `JSON.stringify` emits. */
  toJSON?(): SerializedDateFailure
  type: 'date-range-failure'
}

/**
 * Parse a time range / slot: `2pm to 4pm`, `between 9am and 5pm`, `9-5`,
 * `from 3pm`, `until 5`, with am/pm inference across the pair and cross-midnight
 * rollover. Time-of-day today (next day when past, like `parseDate`).
 * @example
 * ```ts
 * import { parseDateRange } from '@pascal-app/lingo/date'
 * const r = parseDateRange('2pm to 4pm', { now: new Date('2026-07-03T09:00:00') })
 * r.ok && [r.start?.date.getHours(), r.end?.date.getHours()] // [14, 16]
 * ```
 */
export function parseDateRange(text: string, opts?: DateOptions): DateRange | DateRangeFail {
  return attachDateRangeSerialization(parseDateRangeImpl(text, opts))
}

function parseDateRangeImpl(text: string, opts?: DateOptions): DateRange | DateRangeFail {
  const now = opts?.now === undefined ? anchorNow() : new Date(opts.now.getTime())
  const n = normalizeInput(text)
  const localeNotLoaded =
    opts?.locale !== undefined && !isLocaleLoaded(opts.localePacks, opts.locale)
      ? makeIssue(
          'LOCALE_NOT_LOADED',
          { locale: opts.locale },
          toSourceSpan(n, 0, n.text.length),
          opts.messages,
        )
      : undefined
  const p: P = {
    src: text,
    n,
    text: n.text,
    tokens: tokenize(n),
    now,
    opts: opts ?? {},
    profile: resolveLanguageProfile(opts?.localePacks, localeNotLoaded ? 'en' : opts?.locale),
    weekStart: normalizeWeekStart(opts?.weekStart),
    forwardDates: opts?.forwardDates ?? true,
    escalate: dateEscalate(opts),
  }
  if (localeNotLoaded) {
    return { ok: false, type: 'date-range-failure', text, issues: [localeNotLoaded] }
  }
  let source = n.text.trim()
  const issues: LingoIssue[] = []
  // Point the span at the trimmed content, not the padded input.
  const { start: spanStart, end: spanEnd } = trimRange(n.text, 0, n.text.length)
  const span = toSourceSpan(p.n, spanStart, spanEnd)
  // A trailing zone applies to the WHOLE slot ("9am to 5pm PST" is both-PST), so
  // peel it once before splitting; each endpoint inherits it unless it carries
  // its own ("2pm EST to 4pm PST"). Its span is the zone token, for the TZ issue.
  let rangeZone: DateZone | undefined
  let zoneSpan = span
  const strippedRange = stripTrailingZone(source, p.now)
  if (strippedRange && strippedRange.source.trim() !== '') {
    rangeZone = { ...strippedRange.zone, applied: Boolean(p.opts.applyZone) }
    zoneSpan = toSourceSpan(p.n, spanEnd - rangeZone.text.length, spanEnd)
    source = strippedRange.source.trim()
  }
  const inherit = (ep: Endpoint): Endpoint => {
    if (!ep.zone && rangeZone) {
      ep.zone = rangeZone
    }
    return ep
  }
  const fail = (): DateRangeFail => ({
    ok: false,
    type: 'date-range-failure',
    text,
    issues: [makeIssue('UNSUPPORTED_DATE', { example: '"2pm to 4pm"' }, span, p.opts.messages)],
  })

  for (const { re, open } of RANGE_SPLITS) {
    const m = re.exec(source)
    if (!m) {
      continue
    }
    if (open === 'end') {
      const start = parseRangeEndpoint(p, m[1]!)
      if (!start) {
        continue
      }
      const baseDay = rollDay(p, start)
      return finishRange(
        p,
        span,
        zoneSpan,
        issues,
        endpointDate(p, inherit(start), baseDay),
        undefined,
      )
    }
    if (open === 'start') {
      const end = parseRangeEndpoint(p, m[1]!)
      if (!end) {
        continue
      }
      const baseDay = rollDay(p, end)
      return finishRange(
        p,
        span,
        zoneSpan,
        issues,
        undefined,
        endpointDate(p, inherit(end), baseDay),
      )
    }
    let start = parseRangeEndpoint(p, m[1]!)
    let end = parseRangeEndpoint(p, m[2]!)
    if (!(start && end)) {
      continue
    }
    start = inherit(start)
    end = inherit(end)
    ;[start, end] = inferMeridiem(start, end)
    const baseDay = rollDay(p, start)
    const startEp = endpointDate(p, start, baseDay)
    let endEp = endpointDate(p, end, baseDay)
    // Cross-midnight: an end strictly BEFORE the start rolls to the next day
    // ("10pm to 2am"). Deterministic, like forwardDates — no issue raised. Equal
    // endpoints stay a same-day zero-length slot, never a spurious 24h span.
    if (endEp.date.getTime() < startEp.date.getTime()) {
      endEp = endpointDate(p, end, addCalendar(baseDay, { days: 1 }))
    }
    return finishRange(p, span, zoneSpan, issues, startEp, endEp)
  }
  return fail()
}
