import { findQuantities } from '@pascal-app/lingo'

export type TokenCategory = 'date' | 'time' | 'quantity' | 'repeats' | 'duration' | 'plain'

export interface ClassifiedSpan {
  category: TokenCategory
  detail?: string
  end: number
  start: number
  text: string
}

const REPEATS_PATTERNS = [
  /\b(?:every|each)\s+(?:other\s+)?(?:day|weekday|weekend|week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi,
  /\b(?:daily|weekly|monthly|yearly|annually|biweekly|fortnightly)\b/gi,
  /\b(?:the\s+)?last\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(?:each|every)\s+month\b/gi,
  /\b(?:every\s+other\s+[a-z]+)\b/gi,
]

const CLOCK_TIME_PATTERNS = [
  /\b(?:at|@)\s+(?:noon|midnight|\d{1,2}(?::\d{2})?\s*(?:am|pm)?|[a-z]+\s+o'clock)\b/gi,
  /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,
  /\b(?:quarter|half)\s+(?:past|to|of)\s+\w+\b/gi,
  /\bnoon\b/gi,
  /\bmidnight\b/gi,
]

const DURATION_PATTERNS = [
  /\b(?:for|in)\s+(?:half\s+an\s+hour|\d+(?:\.\d+)?\s*(?:min|mins|minutes?|hours?|hrs?|days?|weeks?|months?|seconds?|secs?))\b/gi,
  /\b(?:half\s+an\s+hour|an?\s+hour\s+and\s+a\s+half|\d+\s+hours?\s+and\s+\d+\s+minutes?)\b/gi,
]

const DATE_WORDS_PATTERNS = [
  /\b(?:today|tomorrow|yesterday|tonight|this\s+weekend|next\s+weekend|last\s+weekend|next\s+week|last\s+week|this\s+month|next\s+month|last\s+month)\b/gi,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?\b/gi,
  /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s*,?\s*\d{4})?\b/gi,
  /\b\d{4}-\d{2}-\d{2}\b/gi,
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi,
]

export function classifyTextSpans(input: string, now: Date = new Date()): ClassifiedSpan[] {
  if (!input) {
    return []
  }

  const rawMatches: Array<{
    start: number
    end: number
    text: string
    category: TokenCategory
    priority: number
    detail?: string
  }> = []

  // 1. Check for repeat patterns (highest priority for "every weekday", "last Friday of each month")
  for (const re of REPEATS_PATTERNS) {
    let m: RegExpExecArray | null
    const regex = new RegExp(re.source, re.flags)
    while ((m = regex.exec(input)) !== null) {
      rawMatches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        category: 'repeats',
        priority: 10,
        detail: 'Recurring rule',
      })
    }
  }

  // 2. Duration phrases ("in 20 minutes", "for half an hour")
  for (const re of DURATION_PATTERNS) {
    let m: RegExpExecArray | null
    const regex = new RegExp(re.source, re.flags)
    while ((m = regex.exec(input)) !== null) {
      rawMatches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        category: 'duration',
        priority: 8,
        detail: 'Duration',
      })
    }
  }

  // 3. Clock times ("at 9am", "at eight pm", "10pm")
  for (const re of CLOCK_TIME_PATTERNS) {
    let m: RegExpExecArray | null
    const regex = new RegExp(re.source, re.flags)
    while ((m = regex.exec(input)) !== null) {
      rawMatches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        category: 'time',
        priority: 7,
        detail: 'Clock Time',
      })
    }
  }

  // 4. Dates & days ("October 2", "tomorrow", "Friday", "Sep 4")
  for (const re of DATE_WORDS_PATTERNS) {
    let m: RegExpExecArray | null
    const regex = new RegExp(re.source, re.flags)
    while ((m = regex.exec(input)) !== null) {
      rawMatches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        category: 'date',
        priority: 6,
        detail: 'Day or Date',
      })
    }
  }

  // 5. Quantities / measurements ("$10k", "5 kg", "120 mm", "3 lb 4 oz")
  try {
    const quantities = findQuantities(input)
    for (const q of quantities) {
      rawMatches.push({
        start: q.span.start,
        end: q.span.end,
        text: input.slice(q.span.start, q.span.end),
        category: 'quantity',
        priority: 5,
        detail: q.result.type === 'quantity' ? `${q.result.quantity.format()}` : 'Measurement',
      })
    }
  } catch {
    // fallback if findQuantities fails on partial text
  }

  // Sort matches by start position, then higher priority, then longer length
  rawMatches.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start
    }
    if (b.priority !== a.priority) {
      return b.priority - a.priority
    }
    return b.end - b.start - (a.end - a.start)
  })

  // Resolve overlaps (higher priority wins)
  const resolved: typeof rawMatches = []
  let lastEnd = 0
  for (const m of rawMatches) {
    if (m.start >= lastEnd) {
      resolved.push(m)
      lastEnd = m.end
    }
  }

  // Slice into complete spans covering entire input (including 'plain' gaps)
  const result: ClassifiedSpan[] = []
  let cursor = 0
  for (const m of resolved) {
    if (m.start > cursor) {
      result.push({
        start: cursor,
        end: m.start,
        text: input.slice(cursor, m.start),
        category: 'plain',
      })
    }
    result.push({
      start: m.start,
      end: m.end,
      text: input.slice(m.start, m.end),
      category: m.category,
      detail: m.detail,
    })
    cursor = m.end
  }

  if (cursor < input.length) {
    result.push({
      start: cursor,
      end: input.length,
      text: input.slice(cursor),
      category: 'plain',
    })
  }

  return result
}
