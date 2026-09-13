import type { DateGrain, DateRange, DateResult } from '@pascal-app/lingo/date'

/** True when a reading pinned a time of day, not just a calendar day. */
export function isTimedGrain(grain: DateGrain | undefined): boolean {
  return grain === 'hour' || grain === 'minute' || grain === 'second'
}

/** "Sat, Sep 12" — the day without a year, for tight rows. */
export function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "Sat, Sep 12, 2026" — the day with its year. */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "9:00 AM" */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** Day plus clock when the grain carries one: "Sat, Sep 12 · 9:00 AM". */
export function formatWhen(date: Date, grain: DateGrain | undefined): string {
  return isTimedGrain(grain) ? `${formatDay(date)} · ${formatClock(date)}` : formatDay(date)
}

/**
 * One line for a range: dates when the endpoints are calendar days, day plus
 * clock when either endpoint carries a time of day, so an overnight shift keeps
 * its 10 PM and 2 AM.
 */
export function formatRange(range: DateRange): string {
  const start = range.start
  const end = range.end
  if (!(start || end)) {
    return 'open range'
  }
  const timed = isTimedGrain(start?.grain) || isTimedGrain(end?.grain)
  const show = (date: Date, grain: DateGrain | undefined) =>
    timed ? formatWhen(date, grain) : formatDay(date)
  if (start && end) {
    return `${show(start.date, start.grain)} → ${show(end.date, end.grain)}`
  }
  if (start) {
    return `from ${show(start.date, start.grain)}`
  }
  return `until ${show(end!.date, end!.grain)}`
}

export function formatDateResult(result: DateResult): string {
  return formatWhen(result.date, result.grain)
}
