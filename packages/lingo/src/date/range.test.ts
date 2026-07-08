import { describe, expect, it } from 'vitest'
import { humanizeDateRange } from './humanize'
import { parseDateRange } from './parse'

// A fixed morning reference so time-of-day slots land on the same civil day.
const NOW = new Date(2026, 6, 3, 9, 0, 0) // Fri 2026-07-03 09:00 local

function hm(d: Date): [number, number] {
  return [d.getHours(), d.getMinutes()]
}

describe('parseDateRange', () => {
  it('parses an explicit am/pm pair', () => {
    const r = parseDateRange('2pm to 4pm', { now: NOW })
    expect(r.ok).toBe(true)
    if (!r.ok) {
      return
    }
    expect(hm(r.start!.date)).toEqual([14, 0])
    expect(hm(r.end!.date)).toEqual([16, 0])
    expect(r.start!.date.getDate()).toBe(3)
    expect(r.end!.date.getDate()).toBe(3)
  })

  it('accepts "between X and Y"', () => {
    const r = parseDateRange('between 9am and 5pm', { now: NOW })
    expect(r.ok && [hm(r.start!.date), hm(r.end!.date)]).toEqual([
      [9, 0],
      [17, 0],
    ])
  })

  it('infers the shared half in "2 to 4pm"', () => {
    const r = parseDateRange('2 to 4pm', { now: NOW })
    expect(r.ok && [hm(r.start!.date), hm(r.end!.date)]).toEqual([
      [14, 0],
      [16, 0],
    ])
  })

  it('reads the "9-5" / "9 to 5" workday shift as 9am–5pm', () => {
    for (const text of ['9-5', '9 to 5', '9am-5']) {
      const r = parseDateRange(text, { now: NOW })
      expect(r.ok && [hm(r.start!.date), hm(r.end!.date)]).toEqual([
        [9, 0],
        [17, 0],
      ])
    }
  })

  it('shifts an equal bare pair to a 12h slot, never a 24h span', () => {
    // "6 to 6" is 6am–6pm, not 6am→6am-next-day.
    const r = parseDateRange('6 to 6', { now: NOW })
    expect(r.ok).toBe(true)
    if (!r.ok) {
      return
    }
    expect([hm(r.start!.date), hm(r.end!.date)]).toEqual([
      [6, 0],
      [18, 0],
    ])
    expect(r.start!.date.getDate()).toBe(r.end!.date.getDate())
  })

  it('infers pm for an ambiguous colon end but keeps a 24h pair literal', () => {
    // A colon time without am/pm is ambiguous, so "9 to 5:30" is 9am–5:30pm.
    const inferred = parseDateRange('9 to 5:30', { now: NOW })
    expect(inferred.ok && [hm(inferred.start!.date), hm(inferred.end!.date)]).toEqual([
      [9, 0],
      [17, 30],
    ])
    // A 24h endpoint fixes the whole pair — "05:30 to 17:00" is not re-halved.
    const literal = parseDateRange('05:30 to 17:00', { now: NOW })
    expect(literal.ok && [hm(literal.start!.date), hm(literal.end!.date)]).toEqual([
      [5, 30],
      [17, 0],
    ])
  })

  it('carries minutes and 24h endpoints', () => {
    const r = parseDateRange('from 13:30 to 15:45', { now: NOW })
    expect(r.ok && [hm(r.start!.date), hm(r.end!.date)]).toEqual([
      [13, 30],
      [15, 45],
    ])
  })

  it('rolls a cross-midnight end to the next day', () => {
    const r = parseDateRange('10pm to 2am', { now: NOW })
    expect(r.ok).toBe(true)
    if (!r.ok) {
      return
    }
    expect(hm(r.start!.date)).toEqual([22, 0])
    expect(hm(r.end!.date)).toEqual([2, 0])
    expect(r.end!.date.getDate()).toBe(4)
  })

  it('supports open-ended starts and ends', () => {
    const from = parseDateRange('from 3pm', { now: NOW })
    expect(from.ok && from.end).toBeUndefined()
    expect(from.ok && hm(from.start!.date)).toEqual([15, 0])

    const until = parseDateRange('until 5pm', { now: NOW })
    expect(until.ok && until.start).toBeUndefined()
    expect(until.ok && hm(until.end!.date)).toEqual([17, 0])
  })

  it('binds a trailing zone to the WHOLE slot, not just the last endpoint', () => {
    const r = parseDateRange('2pm to 4pm EST', { now: NOW, applyZone: true })
    expect(r.ok).toBe(true)
    if (!r.ok) {
      return
    }
    // BOTH endpoints are EST: 2pm EST → 19:00Z, 4pm EST (−05:00) → 21:00Z.
    expect(r.start!.date.toISOString()).toBe('2026-07-03T19:00:00.000Z')
    expect(r.end!.date.toISOString()).toBe('2026-07-03T21:00:00.000Z')
    expect(r.start!.zone?.abbreviation).toBe('EST')
    expect(r.end!.zone?.abbreviation).toBe('EST')
  })

  it('does not let a trailing zone hide an endpoint am/pm (inference stays correct)', () => {
    // "3am EST to 5pm": the "am" must survive the zone strip, so start is 3am.
    const r = parseDateRange('3am EST to 5pm', { now: NOW })
    expect(r.ok && [hm(r.start!.date), hm(r.end!.date)]).toEqual([
      [3, 0],
      [17, 0],
    ])
  })

  it('points TZ issue spans at the zone token, not the whole input', () => {
    const r = parseDateRange('3pm to 5pm EST', { now: NOW })
    if (!r.ok) {
      throw new Error('expected ok')
    }
    // "EST" is at offsets 11–14; issues are emitted once, not per endpoint.
    expect(r.issues.map((i) => i.code)).toEqual(['TZ_IGNORED', 'AMBIGUOUS_TIMEZONE'])
    for (const issue of r.issues) {
      expect(issue.span).toEqual({ start: 11, end: 14 })
    }
  })

  it('requires an explicit now for the reference-dependent slot', () => {
    const r = parseDateRange('2pm to 4pm')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.issues[0]?.code).toBe('NOW_REQUIRED')
  })

  it('parses duration ranges anchored by a starting date', () => {
    const now = new Date(2026, 6, 8, 9, 0, 0)
    for (const text of ['3 days starting tomorrow', '3days starting tomorrow']) {
      const r = parseDateRange(text, { now })
      expect(r.ok).toBe(true)
      if (!r.ok) {
        return
      }
      expect(r.span).toEqual({ start: 0, end: text.length })
      expect(r.start?.date).toEqual(new Date(2026, 6, 9))
      expect(r.end?.date).toEqual(new Date(2026, 6, 12))
      expect(r.start?.grain).toBe('day')
      expect(r.end?.grain).toBe('day')

      const phrase = humanizeDateRange(r)
      expect(phrase).toBe('3 days starting 2026-07-09')
      const reparsed = parseDateRange(phrase, { now })
      expect(reparsed.ok).toBe(true)
      if (!reparsed.ok) {
        return
      }
      expect(reparsed.start?.date).toEqual(r.start?.date)
      expect(reparsed.end?.date).toEqual(r.end?.date)
    }
  })

  it('fails cleanly on non-ranges', () => {
    const r = parseDateRange('the quick brown fox', { now: NOW })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.issues[0]?.code).toBe('UNSUPPORTED_DATE')
  })
})

describe('humanizeDateRange round-trips', () => {
  const clock = (d: Date) => [d.getHours(), d.getMinutes()] as const

  for (const [text, hour12] of [
    ['2pm to 4pm', true],
    ['9-5', true],
    ['from 3pm', true],
    ['until 5:30pm', true],
    ['10pm to 2am', true],
    ['noon to midnight', true],
    ['noon to midnight', false],
    ['between 9am and 5pm', false],
    ['13:15 to 14:45', false],
  ] as const) {
    it(`re-parses "${text}" (hour12=${hour12})`, () => {
      const first = parseDateRange(text, { now: NOW })
      expect(first.ok).toBe(true)
      if (!first.ok) {
        return
      }
      const phrase = humanizeDateRange(first, { hour12 })
      const second = parseDateRange(phrase, { now: NOW })
      expect(second.ok).toBe(true)
      if (!second.ok) {
        return
      }
      expect(Boolean(second.start)).toBe(Boolean(first.start))
      expect(Boolean(second.end)).toBe(Boolean(first.end))
      if (first.start && second.start) {
        expect(clock(second.start.date)).toEqual(clock(first.start.date))
      }
      if (first.end && second.end) {
        expect(clock(second.end.date)).toEqual(clock(first.end.date))
      }
    })
  }
})
