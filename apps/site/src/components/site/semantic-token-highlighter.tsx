'use client'

import {
  type DateRange,
  type DateResult,
  type DurationResult,
  humanizeDuration,
  parseDate,
  parseDateRange,
  parseDuration,
} from '@pascal-app/lingo/date'
import { useMemo, useState } from 'react'

import { DemoFrame } from '@/components/site/demo-frame'
import { JsonView } from '@/components/site/json-view'
import { useHydrated } from '@/components/site/use-hydrated'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, formatDateResult, formatRange, formatZone } from '@/lib/date-display'
import { classifyTextSpans, type TokenCategory } from '@/lib/semantic-spans'

/** SSR reference time. After hydration the field switches to the real clock. */
const SSR_NOW = new Date(2026, 8, 11, 19, 49, 0)

/** Every example parses whole except the last: a sentence lingo declines as a
 *  unit while still confirming three of its slices — the point of the tokens. */
const EXAMPLES = [
  'tomorrow at 9am',
  'next friday at 3pm',
  'Friday at 10pm until Saturday at 2am',
  'from Oct 4 through October 8',
  'in 20 minutes',
  '3 days ago',
  '2 hours 30 minutes',
  'dinner on Oct 2 at 8pm for 2 hours',
] as const

type Mode = 'range' | 'date' | 'duration' | 'none'

type Reading =
  | { mode: 'range'; result: DateRange }
  | { mode: 'date'; result: DateResult }
  | { mode: 'duration'; result: DurationResult }
  | { mode: 'none'; message: string | null; result: null }

/**
 * Range first (the stricter reader), then a single date, then a duration —
 * the same order the calendar field uses, plus the duration fallback so
 * "2 hours 30 minutes" reads instead of failing.
 */
function read(text: string, now: Date): Reading {
  if (text.trim() === '') {
    return { mode: 'none', message: null, result: null }
  }
  const range = parseDateRange(text, { now })
  if (range.ok) {
    return { mode: 'range', result: range }
  }
  const single = parseDate(text, { now })
  if (single.ok) {
    return { mode: 'date', result: single }
  }
  const duration = parseDuration(text)
  if (duration.ok) {
    return { mode: 'duration', result: duration }
  }
  return { mode: 'none', message: single.issues[0]?.message ?? null, result: null }
}

const MODE_COPY: Record<Mode, string> = {
  date: 'single date',
  duration: 'duration',
  none: 'no reading',
  range: 'date range',
}

const CATEGORIES: readonly Exclude<TokenCategory, 'plain'>[] = [
  'date',
  'time',
  'duration',
  'quantity',
]

function summary(reading: Reading, tokenCount: number): string {
  switch (reading.mode) {
    case 'range':
      return formatRange(reading.result)
    case 'date':
      return formatDateResult(reading.result)
    case 'duration':
      return humanizeDuration(reading.result.duration, { style: 'long' })
    default:
      if (tokenCount > 0) {
        return `Lingo reads one expression at a time — no whole-input reading, ${tokenCount} ${tokenCount === 1 ? 'slice' : 'slices'} confirmed.`
      }
      return reading.message ?? 'No reading'
  }
}

export function SemanticTokenHighlighter() {
  const hydrated = useHydrated()
  const now = useMemo(() => (hydrated ? new Date() : SSR_NOW), [hydrated])
  const [value, setValue] = useState<string>(EXAMPLES[0])

  const spans = useMemo(() => classifyTextSpans(value, now), [value, now])
  const tokens = useMemo(() => spans.filter((span) => span.category !== 'plain'), [spans])
  const reading = useMemo(() => read(value, now), [value, now])
  // The zone label depends on the visitor's clock, so it waits for hydration
  // — the server's zone would not match and React would flag the text.
  const zone = hydrated ? formatZone(now) : null
  // Same constraint for the JSON: it prints UTC instants, and a local SSR_NOW
  // is a different instant in every zone.
  const output = hydrated ? JSON.stringify(reading.result, null, 2) : ''

  return (
    <DemoFrame
      caption="Regexes propose slices; lingo confirms each one. Anything it declines stays plain."
      details={<JsonView label="Output" value={output} />}
      detailsLabel="Output"
      stageClassName="min-h-[30rem] justify-start"
      title="Token highlighter"
    >
      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Input
            aria-label="Date, time, or duration in plain words"
            className="h-11 rounded-[6px] font-mono text-base"
            onChange={(event) => setValue(event.target.value)}
            placeholder="tomorrow at 9am, in 20 minutes, 2 hours 30 minutes…"
            spellCheck={false}
            value={value}
          />
          <div aria-label="Examples" className="flex flex-wrap gap-1.5" role="group">
            {EXAMPLES.map((example) => (
              <Button
                aria-pressed={value === example}
                className="h-6 rounded-[5px] px-2 font-mono text-[11px]"
                key={example}
                onClick={() => setValue(example)}
                size="xs"
                type="button"
                variant={value === example ? 'secondary' : 'ghost'}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>

        {/* Decorative twin of the list below; the list carries the semantics. */}
        <div
          aria-hidden
          className="corner-smooth flex min-h-[3.25rem] flex-wrap items-center gap-y-1.5 rounded-[10px] bg-muted/40 px-3 py-2.5 font-mono text-[15px] leading-7"
        >
          {spans.length === 0 ? (
            <span className="text-muted-foreground/60">Type to see tokens</span>
          ) : (
            spans.map((span) =>
              span.category === 'plain' ? (
                <span
                  className="whitespace-pre-wrap text-foreground/70"
                  key={`${span.start}-plain`}
                >
                  {span.text}
                </span>
              ) : (
                <span
                  className="token-chip rounded-[5px] border px-1.5 py-px"
                  data-token={span.category}
                  key={`${span.start}-${span.category}`}
                >
                  {span.text}
                </span>
              ),
            )
          )}
        </div>

        <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
          <Badge
            className="font-mono text-[10px] uppercase tracking-wide"
            variant={reading.mode === 'none' ? 'destructive' : 'secondary'}
          >
            {MODE_COPY[reading.mode]}
          </Badge>
          <span className="numeric-mono text-muted-foreground text-sm">
            {summary(reading, tokens.length)}
          </span>
        </div>

        <ul
          aria-label="Confirmed tokens"
          className="corner-smooth divide-y divide-border/60 rounded-[10px] border border-border/60"
        >
          {tokens.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground text-sm">
              No slice confirmed — lingo declined every candidate.
            </li>
          ) : (
            tokens.map((token) => (
              <li
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                key={`${token.start}-${token.category}`}
              >
                <span
                  aria-hidden
                  className="token-dot size-2 shrink-0 rounded-full"
                  data-token={token.category}
                />
                <span className="font-mono text-foreground">{token.text}</span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
                  {token.category}
                </span>
                <span className="numeric-mono ml-auto text-muted-foreground text-sm">
                  {token.reading}
                </span>
              </li>
            ))
          )}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-xs">
          <ul aria-label="Token categories" className="flex flex-wrap gap-3">
            {CATEGORIES.map((category) => (
              <li className="flex items-center gap-1.5" key={category}>
                <span aria-hidden className="token-dot size-2 rounded-full" data-token={category} />
                <span>{category}</span>
              </li>
            ))}
          </ul>
          <span className="numeric-mono">
            relative to {formatDate(now)}
            {zone ? ` · ${zone}` : ''}
          </span>
        </div>
      </div>
    </DemoFrame>
  )
}
