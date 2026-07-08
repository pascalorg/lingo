import type { LingoIssue } from '../core/types'
import type { DateGrain } from './parse'
import { issue, type P, trimRange } from './state'
import { TIME_ALIASES, type TimeAlias } from './vocab'
import { type DateZone, stripTrailingZone } from './zone'

export interface TimeCore {
  grain: DateGrain
  hour: number
  issues: LingoIssue[]
  minute: number
  second: number
  zone?: DateZone
}

export function parseTimeOnly(p: P, start: number, end: number): TimeCore | null {
  const { start: trimStart, end: trimEnd } = trimRange(p.text, start, end)
  if (trimStart === trimEnd) {
    return null
  }
  let source = p.text.slice(trimStart, trimEnd)
  const issues: LingoIssue[] = []
  // Detect and peel a trailing timezone. The zone is EXPOSED on the result
  // (`zone` field); `applyZone` converts to a real UTC instant, otherwise the
  // civil time is kept and a TZ_IGNORED (detected-not-applied) issue rides along.
  let zone: DateZone | undefined
  const stripped = stripTrailingZone(source, p.now)
  if (stripped && stripped.source.trim() !== '') {
    zone = { ...stripped.zone, applied: Boolean(p.opts.applyZone) }
    const zoneStart = trimEnd - zone.text.length
    if (!zone.applied) {
      issues.push(issue(p, 'TZ_IGNORED', { tz: zone.text }, zoneStart, trimEnd))
    }
    if (zone.ambiguous) {
      issues.push(issue(p, 'AMBIGUOUS_TIMEZONE', { tz: zone.text }, zoneStart, trimEnd))
    }
    source = stripped.source
  }
  const core = parseTimeCore(p, source, issues)
  if (core && zone) {
    core.zone = zone
  }
  return core
}

export function parseTimeCore(p: P, source: string, issues: LingoIssue[]): TimeCore | null {
  const lower = source.toLowerCase().replace(/^(?:at|@)\s+/, '')
  const alias = timeAliases(p)[lower]
  if (alias) {
    return aliasTime(alias, issues)
  }

  const meridiem = /^(?:(?:at|@)\s*)?(\d{1,2})(?:[:.](\d{2})(?::(\d{2}))?)?\s*(am|pm)$/i.exec(
    source,
  )
  if (meridiem) {
    let hour = Number(meridiem[1])
    if (hour < 1 || hour > 12) {
      return null
    }
    const minute = meridiem[2] === undefined ? 0 : Number(meridiem[2])
    const second = meridiem[3] === undefined ? 0 : Number(meridiem[3])
    if (minute > 59 || second > 59) {
      return null
    }
    const pm = meridiem[4]!.toLowerCase() === 'pm'
    if (pm && hour < 12) {
      hour += 12
    }
    if (!pm && hour === 12) {
      hour = 0
    }
    return {
      hour,
      minute,
      second,
      grain: meridiem[3] ? 'second' : meridiem[2] ? 'minute' : 'hour',
      issues,
    }
  }
  const clock = /^(?:(?:at|@)\s*)?(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(source)
  if (clock) {
    const hour = Number(clock[1])
    const minute = Number(clock[2])
    const second = clock[3] === undefined ? 0 : Number(clock[3])
    if (hour > 23 || minute > 59 || second > 59) {
      return null
    }
    return { hour, minute, second, grain: clock[3] ? 'second' : 'minute', issues }
  }
  const hClock = /^(?:(?:at|@)\s*)?(\d{1,2})h(\d{2})?$/i.exec(source)
  if (hClock) {
    const hour = Number(hClock[1])
    const minute = hClock[2] === undefined ? 0 : Number(hClock[2])
    if (hour > 23 || minute > 59) {
      return null
    }
    // Bare "17h" is grain hour; "17h30" is grain minute.
    return { hour, minute, second: 0, grain: hClock[2] === undefined ? 'hour' : 'minute', issues }
  }
  // 24-hour dot separator, unambiguous only when hour ≥ 13 ("17.30"); bare
  // "5.30" stays a decimal (Codex: never reinterpret it as a time).
  const dotClock = /^(?:(?:at|@)\s*)?(1\d|2[0-3])\.(\d{2})$/.exec(source)
  if (dotClock) {
    const hour = Number(dotClock[1])
    const minute = Number(dotClock[2])
    if (minute > 59) {
      return null
    }
    return { hour, minute, second: 0, grain: 'minute', issues }
  }
  // "5 o'clock", "5 o'clock pm".
  const oclock = /^(?:(?:at|@)\s*)?(\d{1,2})\s*o'?clock(?:\s*(am|pm))?$/i.exec(source)
  if (oclock) {
    let hour = Number(oclock[1])
    if (hour < 1 || hour > 12) {
      return null
    }
    const mer = oclock[2]?.toLowerCase()
    if (mer === 'pm' && hour < 12) {
      hour += 12
    }
    if (mer === 'am' && hour === 12) {
      hour = 0
    }
    return { hour, minute: 0, second: 0, grain: 'hour', issues }
  }
  // Military "0900 hours", "1730 hrs" — REQUIRE the suffix so bare 4-digit
  // numbers (years/counts) are never read as times.
  const military = /^(\d{1,2})(\d{2})\s*(?:hours|hrs|hr)$/i.exec(source)
  if (military) {
    const hour = Number(military[1])
    const minute = Number(military[2])
    if (hour > 23 || minute > 59) {
      return null
    }
    return { hour, minute, second: 0, grain: 'minute', issues }
  }
  const relative = parseRelativeMinutes(lower, issues)
  if (relative) {
    return relative
  }
  const phrase = /^(?:(?:at|@)\s*)?(\d{1,2})\s+in\s+the\s+(morning|afternoon|evening|night)$/i.exec(
    source,
  )
  if (phrase) {
    let hour = Number(phrase[1])
    if (hour < 1 || hour > 12) {
      return null
    }
    const part = phrase[2]!.toLowerCase()
    if ((part === 'afternoon' || part === 'evening' || part === 'night') && hour < 12) {
      hour += 12
    }
    if (part === 'morning' && hour === 12) {
      hour = 0
    }
    return { hour, minute: 0, second: 0, grain: 'hour', issues }
  }
  return null
}

function timeAliases(p: P): Record<string, TimeAlias> {
  return p.profile.date?.timeAliases ?? TIME_ALIASES
}

function aliasTime(alias: TimeAlias, issues: LingoIssue[]): TimeCore {
  return {
    hour: alias.hour,
    minute: alias.minute ?? 0,
    second: alias.second ?? 0,
    grain: alias.grain ?? 'hour',
    issues,
  }
}

const TIME_NUM_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  'twenty-five': 25,
  'twenty five': 25,
}

function wordOrDigit(token: string): number | null {
  if (/^\d{1,2}$/.test(token)) {
    return Number(token)
  }
  return TIME_NUM_WORDS[token] ?? null
}

function minuteAmount(token: string): number | null {
  if (token === 'quarter') {
    return 15
  }
  if (token === 'half') {
    return 30
  }
  const n = wordOrDigit(token)
  return n !== null && n >= 1 && n <= 59 ? n : null
}

function hourAmount(token: string): number | null {
  const n = wordOrDigit(token)
  return n !== null && n >= 1 && n <= 23 ? n : null
}

/**
 * Spoken relative-minute times: "quarter past 5" (5:15), "half past 3" (3:30),
 * "quarter to 6" (5:45), "twenty past 4", "ten to 6", and British "half 5" (5:30).
 */
function parseRelativeMinutes(lower: string, issues: LingoIssue[]): TimeCore | null {
  const british = /^half\s+(\d{1,2}|[a-z-]+)$/.exec(lower)
  if (british) {
    const h = hourAmount(british[1]!)
    if (h !== null && h >= 1 && h <= 12) {
      return { hour: h, minute: 30, second: 0, grain: 'minute', issues }
    }
  }
  const m =
    /^(quarter|half|\d{1,2}|[a-z-]+)\s+(past|after|to|till|til|before)\s+(\d{1,2}|[a-z-]+)$/.exec(
      lower,
    )
  if (!m) {
    return null
  }
  const amount = minuteAmount(m[1]!)
  const hour = hourAmount(m[3]!)
  if (amount === null || hour === null) {
    return null
  }
  if (m[2] === 'past' || m[2] === 'after') {
    return { hour: hour % 24, minute: amount, second: 0, grain: 'minute', issues }
  }
  // to/till/before: `amount` minutes before `hour`. Require a minute WORD
  // (quarter/half/ten/…), never a bare digit, so "5 to 6"/"9 to 5" stay a time
  // RANGE (parseDateRange) instead of misreading as 5:55 / 4:51.
  if (/^\d/.test(m[1]!)) {
    return null
  }
  return { hour: (hour + 23) % 24, minute: 60 - amount, second: 0, grain: 'minute', issues }
}
