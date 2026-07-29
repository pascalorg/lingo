'use client'

import {
  type DateRange,
  type DateResult,
  humanizeDateRange,
  parseDate,
  parseDateRange,
} from '@pascal-app/lingo/date'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { DemoFrame } from '@/components/site/demo-frame'
import { JsonView } from '@/components/site/json-view'
import { useHydrated } from '@/components/site/use-hydrated'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** SSR reference time. After hydration the field switches to the real clock. */
const SSR_NOW = new Date(2026, 6, 3, 9, 0, 0)

const EXAMPLES = [
  'next week',
  'this weekend',
  'Aug 3 - Aug 9',
  'tomorrow',
  '3 days starting monday',
  '2pm to 4pm',
] as const

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

type Mode = 'range' | 'slot' | 'single' | 'none'

interface Reading {
  end: Date | null
  mode: Mode
  result: DateRange | DateResult | null
  start: Date | null
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1)
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Six Monday-first weeks covering the month, so the grid never changes height. */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const lead = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => addDays(first, i - lead))
}

/**
 * Range first, then single date. `parseDateRange` is the stricter reader — it
 * declines "tomorrow" — so trying it first is what lets one field decide
 * between a day, a span, and a time slot without the caller picking a mode.
 */
function read(text: string, now: Date): Reading {
  const empty: Reading = { end: null, mode: 'none', result: null, start: null }
  if (text.trim() === '') {
    return empty
  }
  const range = parseDateRange(text, { now })
  if (range.ok) {
    const start = range.start?.date ?? null
    const end = range.end?.date ?? null
    const clock = !range.dated
    return { end, mode: clock ? 'slot' : 'range', result: range, start }
  }
  const single = parseDate(text, { now })
  if (single.ok) {
    return { end: null, mode: 'single', result: single, start: single.date }
  }
  return empty
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function summary(reading: Reading): string {
  const { start, end, mode } = reading
  if (mode === 'none' || !(start || end)) {
    return 'No reading'
  }
  if (mode === 'single' && start) {
    return start.toLocaleDateString('en-US', { dateStyle: 'full' })
  }
  if (mode === 'slot' && reading.result && 'type' in reading.result) {
    return humanizeDateRange(reading.result as DateRange)
  }
  const days =
    start && end
      ? Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 864e5) + 1
      : 0
  const left = start ? start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : '—'
  const right = end
    ? end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'open'
  return days > 0
    ? `${left} → ${right} · ${days} ${days === 1 ? 'day' : 'days'}`
    : `${left} → ${right}`
}

const MODE_COPY: Record<Mode, string> = {
  none: 'no reading',
  range: 'date range',
  single: 'single date',
  slot: 'time slot',
}

export function CalendarFieldDemo() {
  const hydrated = useHydrated()
  const now = useMemo(() => (hydrated ? new Date() : SSR_NOW), [hydrated])
  const [value, setValue] = useState('next week')
  const [cursor, setCursor] = useState<Date | null>(null)

  const reading = useMemo(() => read(value, now), [value, now])
  const { mode, start, end } = reading
  const twoUp = mode === 'range'

  // The calendar follows the parse unless the reader has paged away from it.
  const anchor =
    cursor ??
    (start
      ? new Date(start.getFullYear(), start.getMonth(), 1)
      : new Date(now.getFullYear(), now.getMonth(), 1))
  const months = twoUp ? [anchor, addMonths(anchor, 1)] : [anchor]

  const select = useCallback(
    (day: Date) => {
      setCursor(new Date(day.getFullYear(), day.getMonth(), 1))
      // Clicking inside a single-date reading extends it into a range — the
      // widget grows a second calendar rather than the reader choosing one.
      if (mode === 'single' && start && !sameDay(start, day)) {
        const [a, b] = day < start ? [day, start] : [start, day]
        setValue(`${ymd(a)} to ${ymd(b)}`)
        return
      }
      setValue(ymd(day))
    },
    [mode, start],
  )

  const inRange = useCallback(
    (day: Date): boolean => {
      if (!(start && end) || mode === 'slot') {
        return false
      }
      const t = startOfDay(day).getTime()
      return t > startOfDay(start).getTime() && t < startOfDay(end).getTime()
    },
    [start, end, mode],
  )

  const isEdge = useCallback(
    (day: Date): 'start' | 'end' | 'only' | null => {
      if (mode === 'slot') {
        return start && sameDay(start, day) ? 'only' : null
      }
      if (start && sameDay(start, day)) {
        return end && !sameDay(start, end) ? 'start' : 'only'
      }
      if (end && sameDay(end, day)) {
        return 'end'
      }
      return null
    },
    [start, end, mode],
  )

  return (
    <DemoFrame
      caption="One field. The reading picks the widget — a day, a span, or a slot."
      details={<JsonView label="Output" value={JSON.stringify(reading.result, null, 2)} />}
      detailsLabel="Output"
      stageClassName="min-h-[34rem] justify-start"
      title="Adaptive date field"
    >
      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Input
            aria-label="Date, range, or time slot"
            className="h-11 rounded-[6px] font-mono text-base"
            onChange={(e) => {
              setValue(e.target.value)
              setCursor(null)
            }}
            placeholder="next week, Aug 3 - Aug 9, tomorrow…"
            spellCheck={false}
            value={value}
          />
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <Button
                className="h-6 rounded-[5px] px-2 font-mono text-[11px]"
                key={example}
                onClick={() => {
                  setValue(example)
                  setCursor(null)
                }}
                size="xs"
                type="button"
                variant={value === example ? 'secondary' : 'ghost'}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
          <Badge
            className="font-mono text-[10px] uppercase tracking-wide"
            variant={mode === 'none' ? 'destructive' : 'secondary'}
          >
            {MODE_COPY[mode]}
          </Badge>
          <span className="numeric-mono text-muted-foreground text-sm">{summary(reading)}</span>
        </div>

        <div className="corner-smooth rounded-[10px] bg-muted/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Button
              aria-label="Previous month"
              onClick={() => setCursor(addMonths(anchor, -1))}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronLeft aria-hidden />
            </Button>
            {/* The second month is dropped below `sm` rather than scrolled:
                248px twice never fits a phone, and a clipped calendar reads as
                broken where a single month reads as deliberate. */}
            <div className="flex gap-4 sm:gap-8">
              {months.map((month, index) => (
                <div
                  className={cn(
                    'w-[13.5rem] text-center font-[525] text-[13px] text-foreground sm:w-[15.5rem]',
                    index > 0 && 'hidden sm:block',
                  )}
                  key={month.getTime()}
                >
                  {monthLabel(month)}
                </div>
              ))}
            </div>
            <Button
              aria-label="Next month"
              onClick={() => setCursor(addMonths(anchor, 1))}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <ChevronRight aria-hidden />
            </Button>
          </div>
          <div className="flex justify-center gap-4 sm:gap-8">
            {months.map((month, index) => (
              <table
                className={cn(
                  'w-[13.5rem] border-separate border-spacing-0 sm:w-[15.5rem]',
                  index > 0 && 'hidden sm:table',
                )}
                key={month.getTime()}
              >
                <caption className="sr-only">{monthLabel(month)}</caption>
                <thead>
                  <tr>
                    {WEEKDAYS.map((day) => (
                      <th
                        className="pb-1 font-medium text-[10px] text-muted-foreground uppercase"
                        key={day}
                        scope="col"
                      >
                        <span aria-hidden>{day.slice(0, 2)}</span>
                        <span className="sr-only">{day}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }, (_, week) => (
                    <tr key={week}>
                      {monthGrid(month)
                        .slice(week * 7, week * 7 + 7)
                        .map((day) => {
                          const outside = day.getMonth() !== month.getMonth()
                          const edge = isEdge(day)
                          const between = inRange(day)
                          return (
                            <td className="p-0" key={day.getTime()}>
                              <button
                                aria-pressed={Boolean(edge)}
                                className={cn(
                                  'relative h-8 w-full rounded-[5px] text-center text-[12px] tabular-nums transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)]',
                                  outside ? 'text-muted-foreground/35' : 'text-foreground',
                                  between && 'bg-foreground/8',
                                  edge && 'bg-foreground font-medium text-background',
                                  !(edge || between) && 'hover:bg-foreground/8',
                                  sameDay(day, now) &&
                                    !edge &&
                                    'ring-1 ring-foreground/25 ring-inset',
                                )}
                                onClick={() => select(day)}
                                type="button"
                              >
                                <span className="sr-only">
                                  {day.toLocaleDateString('en-US', { dateStyle: 'full' })}
                                </span>
                                <span aria-hidden>{day.getDate()}</span>
                              </button>
                            </td>
                          )
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </div>
        </div>
      </div>
    </DemoFrame>
  )
}
