import { findQuantities } from '@pascal-app/lingo'
import { humanizeDuration, parseDate, parseDuration } from '@pascal-app/lingo/date'

import { formatClock, formatDay, formatWhen, isTimedGrain } from '@/lib/date-display'

export type TokenCategory = 'date' | 'time' | 'duration' | 'quantity' | 'plain'

export interface ClassifiedSpan {
  category: TokenCategory
  end: number
  /** What lingo read the slice as — absent for plain text. */
  reading?: string
  start: number
  text: string
}

interface Candidate extends ClassifiedSpan {
  priority: number
}

const WEEKDAY = 'monday|tuesday|wednesday|thursday|friday|saturday|sunday'
const MONTH =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec'
const DAY_UNIT = 'days?|weeks?|wks?|months?|years?|yrs?'
const CLOCK_UNIT = 'seconds?|secs?|minutes?|mins?|hours?|hrs?'
const SMALL_WORD = 'a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve'
const HOUR_WORD = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve'

/**
 * Regexes only propose slices; `parseDate` has to accept each one before it is
 * shown as a token. Lingo exposes one whole-match span per result, not
 * sub-token spans, so pre-segmentation is how a sentence is broken up — and
 * validation is what keeps the colors honest.
 */
const DATE_CANDIDATES = [
  /\bday\s+after\s+tomorrow\b/gi,
  /\b(?:today|tomorrow|yesterday)\b/gi,
  new RegExp(`\\b(?:next|last|this)\\s+(?:week|weekend|month|year|${WEEKDAY})\\b`, 'gi'),
  new RegExp(`\\b(?:${WEEKDAY})\\b`, 'gi'),
  /\bend\s+of\s+(?:the\s+)?(?:week|month|year)\b/gi,
  new RegExp(`\\bin\\s+(?:${SMALL_WORD}|\\d+)\\s+(?:${DAY_UNIT})\\b`, 'gi'),
  new RegExp(`\\b(?:${SMALL_WORD}|\\d+)\\s+(?:${DAY_UNIT})\\s+ago\\b`, 'gi'),
  new RegExp(`\\b(?:${MONTH})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{4})?\\b`, 'gi'),
  new RegExp(
    `\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTH})\\b(?:\\s*,?\\s*\\d{4})?`,
    'gi',
  ),
  /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?\b/g,
]

const TIME_CANDIDATES = [
  /\b(?:tonight|this\s+(?:morning|afternoon|evening))\b/gi,
  new RegExp(`\\b(?:tomorrow|${WEEKDAY})\\s+(?:morning|afternoon|evening|night)\\b`, 'gi'),
  new RegExp(`\\bin\\s+(?:${SMALL_WORD}|\\d+)\\s+(?:${CLOCK_UNIT})\\b`, 'gi'),
  /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)\b/gi,
  /\b(?:at\s+)?\d{1,2}:\d{2}\b/gi,
  new RegExp(`\\b(?:at\\s+)?(?:${HOUR_WORD}|\\d{1,2})\\s+o'clock\\b`, 'gi'),
  /\b(?:quarter|half)\s+(?:past|to)\s+(?:\w+)\b/gi,
  /\b(?:at\s+)?(?:noon|midnight)\b/gi,
]

const DURATION_CANDIDATES = [
  /\bhalf\s+an\s+hour\b/gi,
  new RegExp(`\\b(?:${SMALL_WORD})\\s+(?:${CLOCK_UNIT}|${DAY_UNIT})\\s+and\\s+a\\s+half\\b`, 'gi'),
  new RegExp(
    `\\b(?:${SMALL_WORD}|\\d+(?:\\.\\d+)?)\\s*(?:${CLOCK_UNIT}|${DAY_UNIT})(?:\\s+(?:and\\s+)?\\d+\\s*(?:${CLOCK_UNIT}))?\\b`,
    'gi',
  ),
]

const DAY_WORDS =
  /\b(?:in|ago|today|tomorrow|tonight|yesterday|this|next|last|morning|afternoon|evening|night)\b|\d{4}-\d{2}-\d{2}/i

function scan(input: string, patterns: RegExp[], visit: (start: number, end: number) => void) {
  for (const re of patterns) {
    re.lastIndex = 0
    let m = re.exec(input)
    while (m !== null) {
      if (m[0].length > 0) {
        visit(m.index, m.index + m[0].length)
      }
      m = re.exec(input)
    }
  }
}

export function classifyTextSpans(input: string, now: Date): ClassifiedSpan[] {
  if (!input) {
    return []
  }

  const candidates: Candidate[] = []
  const propose = (start: number, end: number, category: TokenCategory, reading: string) => {
    const priority =
      category === 'time' ? 4 : category === 'date' ? 3 : category === 'duration' ? 2 : 1
    candidates.push({ category, end, priority, reading, start, text: input.slice(start, end) })
  }

  const confirmDate = (start: number, end: number, category: 'date' | 'time') => {
    const slice = input.slice(start, end)
    const result = parseDate(slice, { now })
    if (!result.ok) {
      return
    }
    // A relative offset like "in 2 hours" lands in the time list, but the
    // reading decides the label: the grain is what the user actually pinned.
    const timed = isTimedGrain(result.grain)
    const label =
      category === 'time' && !timed ? 'date' : category === 'date' && timed ? 'time' : category
    // A bare clock ("at 3pm") only pins a time of day; naming the day lingo
    // filled in would over-claim what the slice says. Offsets and day words
    // ("in 20 minutes", "tomorrow morning") do carry a day.
    const carriesDay = result.known.includes('weekday') || DAY_WORDS.test(slice)
    const reading = timed
      ? carriesDay
        ? formatWhen(result.date, result.grain)
        : formatClock(result.date)
      : formatDay(result.date)
    propose(start, end, label, reading)
  }

  scan(input, DATE_CANDIDATES, (start, end) => confirmDate(start, end, 'date'))
  scan(input, TIME_CANDIDATES, (start, end) => confirmDate(start, end, 'time'))
  scan(input, DURATION_CANDIDATES, (start, end) => {
    const result = parseDuration(input.slice(start, end))
    if (result.ok) {
      propose(start, end, 'duration', humanizeDuration(result.duration))
    }
  })

  for (const hit of findQuantities(input)) {
    const { result } = hit
    // A bare number ("9" in "at 9am") is not a measurement.
    if (result.type === 'number') {
      continue
    }
    const reading =
      result.type === 'quantity'
        ? result.quantity.format()
        : result.type === 'range'
          ? result.range.format()
          : result.type === 'conversion'
            ? result.converted.format()
            : input.slice(hit.span.start, hit.span.end)
    propose(hit.span.start, hit.span.end, 'quantity', reading)
  }

  // Highest priority first, then the longest slice, then reading order; take
  // greedily so a confirmed time is never swallowed by a quantity underneath it.
  candidates.sort(
    (a, b) => b.priority - a.priority || b.end - b.start - (a.end - a.start) || a.start - b.start,
  )
  const chosen: Candidate[] = []
  for (const c of candidates) {
    if (chosen.every((k) => c.end <= k.start || c.start >= k.end)) {
      chosen.push(c)
    }
  }
  chosen.sort((a, b) => a.start - b.start)

  const spans: ClassifiedSpan[] = []
  let cursor = 0
  for (const { priority: _, ...span } of chosen) {
    if (span.start > cursor) {
      spans.push({
        category: 'plain',
        end: span.start,
        start: cursor,
        text: input.slice(cursor, span.start),
      })
    }
    spans.push(span)
    cursor = span.end
  }
  if (cursor < input.length) {
    spans.push({ category: 'plain', end: input.length, start: cursor, text: input.slice(cursor) })
  }
  return spans
}
