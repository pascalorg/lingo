'use client'

import { parseDate, parseDateRange } from '@pascal-app/lingo/date'
import { CalendarIcon, ClockIcon, RepeatIcon, SparklesIcon, TimerIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useHydrated } from '@/components/site/use-hydrated'
import { classifyTextSpans, type TokenCategory } from '@/lib/semantic-spans'
import { cn } from '@/lib/utils'

const SSR_NOW = new Date(2026, 8, 11, 19, 49, 0) // Friday Sep 11, 2026

interface PresetExample {
  label: string
  text: string
}

const PRESET_EXAMPLES: PresetExample[] = [
  { label: 'A REMINDER', text: 'tomorrow at 9am' },
  { label: 'DINNER, MID-SENTENCE', text: 'book dinner for October 2 at eight pm' },
  { label: 'STANDUP', text: 'every weekday at nine am' },
  { label: 'OVERNIGHT SHIFT', text: 'Friday at 10pm until Saturday at 2am' },
  { label: 'A TRIP', text: 'from Sep 4 through September 8' },
  { label: 'PAYDAY', text: 'the last Friday of each month' },
  { label: 'TWO-WEEK CYCLE', text: 'every other Friday at noon' },
  { label: 'A TIMER', text: 'in 20 minutes for half an hour' },
]

const CATEGORY_STYLES: Record<
  TokenCategory,
  { bg: string; text: string; dot: string; label: string; icon: typeof CalendarIcon }
> = {
  date: {
    bg: 'bg-blue-100 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800/60',
    text: 'text-blue-900 dark:text-blue-200',
    dot: 'bg-blue-500',
    label: 'Day or Date',
    icon: CalendarIcon,
  },
  time: {
    bg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800/60',
    text: 'text-amber-900 dark:text-amber-200',
    dot: 'bg-amber-500',
    label: 'Clock Time',
    icon: ClockIcon,
  },
  repeats: {
    bg: 'bg-purple-100 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800/60',
    text: 'text-purple-900 dark:text-purple-200',
    dot: 'bg-purple-500',
    label: 'Repeats',
    icon: RepeatIcon,
  },
  duration: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800/60',
    text: 'text-emerald-900 dark:text-emerald-200',
    dot: 'bg-emerald-500',
    label: 'How Long',
    icon: TimerIcon,
  },
  quantity: {
    bg: 'bg-sky-100 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800/60',
    text: 'text-sky-900 dark:text-sky-200',
    dot: 'bg-sky-500',
    label: 'Measurement',
    icon: SparklesIcon,
  },
  plain: {
    bg: '',
    text: 'text-foreground',
    dot: '',
    label: 'Plain text',
    icon: SparklesIcon,
  },
}

function formatDateDisplay(d: Date): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const day = d.getDate()
  const year = d.getFullYear()
  return `${weekday}, ${month} ${day}, ${year}`
}

function formatTimeDisplay(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function SemanticTokenHighlighter() {
  const [input, setInput] = useState('book dinner for October 2 at eight pm')
  const hydrated = useHydrated()
  const now = hydrated ? new Date() : SSR_NOW

  const spans = useMemo(() => classifyTextSpans(input, now), [input, now])

  // Compute parsed reading using Lingo
  const parsedData = useMemo(() => {
    // 1. Try date range
    const range = parseDateRange(input, { now })
    if (range.ok) {
      return {
        type: 'range' as const,
        start: range.start?.date ?? null,
        end: range.end?.date ?? null,
        dated: range.dated,
        text: range.text,
      }
    }
    // 2. Try single date
    const single = parseDate(input, { now })
    if (single.ok) {
      return {
        type: 'single' as const,
        date: single.date,
        grain: single.grain,
        text: single.text,
      }
    }
    return null
  }, [input, now])

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
          Plain English to Real Dates
        </h3>
        <p className="max-w-xl text-muted-foreground text-sm sm:text-base">
          Zero-latency recursive-descent parser running locally in your browser. Live span
          categorization and deterministic canonical outputs.
        </p>
      </div>

      {/* Main Interactive Card */}
      <div className="overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-raise-sm sm:p-6">
        <div className="flex items-center justify-between pb-3 text-muted-foreground text-xs">
          <span className="font-mono font-semibold text-[11px] uppercase tracking-wider">
            TRY IT OUT
          </span>
          <span>Type any date or time</span>
        </div>

        {/* Input with live Highlighted Span Overlay */}
        <div className="relative mb-5 min-h-[4.5rem] rounded-xl border border-border bg-[var(--control-background)] p-3 font-normal text-lg leading-relaxed focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20 sm:text-xl">
          <div className="flex flex-wrap items-center gap-1.5">
            {spans.map((span, idx) => {
              if (span.category === 'plain') {
                return (
                  <span className="text-foreground" key={idx}>
                    {span.text}
                  </span>
                )
              }
              const style = CATEGORY_STYLES[span.category]
              return (
                <span
                  className={cn(
                    'inline-flex items-center rounded-md border px-2 py-0.5 font-medium text-[0.95em] transition-all duration-150',
                    style.bg,
                    style.text,
                  )}
                  key={idx}
                  title={span.detail ?? style.label}
                >
                  {span.text}
                </span>
              )
            })}
          </div>
          <input
            aria-label="Natural language date input"
            className="absolute inset-0 h-full w-full cursor-text px-3 text-lg opacity-0"
            onChange={(e) => setInput(e.target.value)}
            value={input}
          />
        </div>

        {/* Canonical Output Card */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="mb-2 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
            Result
          </div>
          {parsedData ? (
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
              <div className="font-semibold text-foreground text-lg sm:text-xl">
                {parsedData.type === 'single' && parsedData.date
                  ? formatDateDisplay(parsedData.date)
                  : parsedData.type === 'range' && parsedData.start
                    ? parsedData.end
                      ? `${formatDateDisplay(parsedData.start)} — ${formatDateDisplay(parsedData.end)}`
                      : `From ${formatDateDisplay(parsedData.start)}`
                    : 'Parsed successfully'}
              </div>
              <div className="font-medium font-mono text-foreground text-sm sm:text-base">
                {parsedData.type === 'single' &&
                parsedData.date &&
                (parsedData.grain === 'hour' || parsedData.grain === 'minute')
                  ? formatTimeDisplay(parsedData.date)
                  : parsedData.type === 'range' && parsedData.start && !parsedData.dated
                    ? `${formatTimeDisplay(parsedData.start)}${parsedData.end ? ` – ${formatTimeDisplay(parsedData.end)}` : ''}`
                    : null}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm italic">
              Type a time, day, calendar period or recurring expression to evaluate canonical
              values.
            </div>
          )}
          <div className="mt-2 text-muted-foreground text-xs">
            Relative to {formatDateDisplay(now)} ·{' '}
            {now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 font-medium text-muted-foreground text-xs">
          {(['date', 'time', 'repeats', 'duration'] as TokenCategory[]).map((cat) => {
            const style = CATEGORY_STYLES[cat]
            return (
              <div className="flex items-center gap-1.5" key={cat}>
                <span className={cn('size-2.5 rounded-full', style.dot)} />
                <span>{style.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Tap One, See The Dates Section */}
      <div className="flex flex-col gap-3">
        <div className="text-center">
          <h4 className="font-medium text-foreground text-sm">Tap One, See The Dates</h4>
          <p className="text-muted-foreground text-xs">Each of these runs in the box above</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PRESET_EXAMPLES.map((example) => {
            const exampleSpans = classifyTextSpans(example.text, now)
            return (
              <button
                className="group flex flex-col items-start gap-1.5 rounded-xl border border-border/70 bg-card p-3.5 text-left transition-all duration-150 hover:border-primary/50 hover:bg-muted/40 hover:shadow-raise-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                key={example.text}
                onClick={() => setInput(example.text)}
                type="button"
              >
                <span className="font-mono font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
                  {example.label}
                </span>
                <div className="flex flex-wrap items-center gap-1 text-foreground text-sm">
                  {exampleSpans.map((span, sIdx) => {
                    if (span.category === 'plain') {
                      return <span key={sIdx}>{span.text}</span>
                    }
                    const style = CATEGORY_STYLES[span.category]
                    return (
                      <span
                        className={cn(
                          'rounded border px-1.5 py-0.5 font-medium text-xs',
                          style.bg,
                          style.text,
                        )}
                        key={sIdx}
                      >
                        {span.text}
                      </span>
                    )
                  })}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
