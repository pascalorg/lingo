'use client'

import { type DateRange, type DateResult, parseDate, parseDateRange } from '@pascal-app/lingo/date'
import { ClockIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DemoFrame } from '@/components/site/demo-frame'
import { JsonView } from '@/components/site/json-view'
import { useHydrated } from '@/components/site/use-hydrated'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Select } from '@/components/ui/select'
import { formatDateResult, formatDay, formatRange } from '@/lib/date-display'
import { cn } from '@/lib/utils'

/** SSR reference time. After hydration the popover switches to the real clock. */
const SSR_NOW = new Date(2026, 8, 11, 19, 49, 0)

/** Each preset is a phrase lingo reads, not a hard-coded clock. "someday"
 *  deliberately has none: it parks the item without a date. */
const PRESETS = [
  { label: 'tomorrow', phrase: 'tomorrow at 8am' },
  { label: 'next week', phrase: 'next monday at 8am' },
  { label: 'this weekend', phrase: 'saturday at 10am' },
  { label: 'someday', phrase: null },
] as const

const CONDITIONS = ['if no reply', 'regardless', 'if unresolved'] as const
type Condition = (typeof CONDITIONS)[number]

type Reading =
  | { ok: true; label: string; result: DateResult | DateRange }
  | { ok: false; message: string | null; result: null }

function read(phrase: string, now: Date): Reading {
  if (phrase.trim() === '') {
    return { ok: false, message: null, result: null }
  }
  const range = parseDateRange(phrase, { now })
  if (range.ok) {
    return { ok: true, label: formatRange(range), result: range }
  }
  const single = parseDate(phrase, { now })
  if (single.ok) {
    return { ok: true, label: formatDateResult(single), result: single }
  }
  return { ok: false, message: single.issues[0]?.message ?? null, result: null }
}

interface Reminder {
  condition: Condition
  phrase: string | null
}

export function RemindMePopoverBlock() {
  const hydrated = useHydrated()
  const now = useMemo(() => (hydrated ? new Date() : SSR_NOW), [hydrated])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [condition, setCondition] = useState<Condition>('if no reply')
  // Only the phrase is stored; the date is re-read from `now`, so a reminder
  // set before hydration is never a stale SSR instant.
  const [reminder, setReminder] = useState<Reminder>({
    condition: 'if no reply',
    phrase: PRESETS[0].phrase,
  })

  const queryReading = useMemo(() => read(query, now), [query, now])
  const reminderReading = useMemo(() => read(reminder.phrase ?? '', now), [reminder.phrase, now])
  const presetReadings = useMemo(
    () => PRESETS.map((preset) => (preset.phrase ? read(preset.phrase, now) : null)),
    [now],
  )
  // The JSON prints UTC instants, and a local SSR_NOW is a different instant in
  // every zone, so the panel waits for hydration.
  const output = hydrated ? JSON.stringify(reminderReading.result, null, 2) : ''

  const commit = (phrase: string | null) => {
    setReminder({ condition, phrase })
    setQuery('')
    setOpen(false)
  }

  return (
    <DemoFrame
      caption="One popover, one field. Presets and free text go through the same reader."
      details={<JsonView label="Output" value={output} />}
      detailsLabel="Output"
      stageClassName="min-h-[16rem] justify-start"
      title="Remind me"
    >
      <div className="mx-auto flex w-full max-w-[30rem] flex-col gap-4">
        <div className="corner-smooth flex items-center justify-between gap-4 rounded-[10px] border border-border/60 bg-card px-4 py-3 shadow-raise-sm">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-[525] text-[13px] text-foreground">Review Q3 forecast</span>
            <span className="text-muted-foreground text-xs">Thread from Dana · 3 messages</span>
          </div>
          <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger render={<Button size="sm" type="button" variant="outline" />}>
              <ClockIcon aria-hidden data-slot="button-icon" />
              Remind me
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[22rem]">
              <div className="flex items-center gap-2 border-border/60 border-b px-3 py-2.5">
                <ClockIcon aria-hidden className="size-3.5 text-muted-foreground" />
                <PopoverTitle>Remind me</PopoverTitle>
              </div>
              <div className="flex items-center gap-2 border-border/60 border-b px-3 py-2">
                <Input
                  aria-label="When to remind"
                  autoFocus
                  className="h-8 flex-1 rounded-[6px] font-mono text-sm md:text-sm"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && queryReading.ok) {
                      event.preventDefault()
                      commit(query.trim())
                    }
                  }}
                  placeholder="8 am, in 3 days, aug 7"
                  spellCheck={false}
                  value={query}
                />
                <Select
                  aria-label="Condition"
                  className="w-[8.5rem]"
                  onValueChange={(value) => setCondition(value as Condition)}
                  options={CONDITIONS.map((item) => ({ label: item, value: item }))}
                  value={condition}
                />
              </div>
              {query.trim() === '' ? null : (
                <div className="flex items-center justify-between gap-3 border-border/60 border-b bg-muted/40 px-3 py-2 text-xs">
                  {queryReading.ok ? (
                    <>
                      <span className="numeric-mono text-foreground">{queryReading.label}</span>
                      <span className="shrink-0 text-muted-foreground">Enter to set</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      {queryReading.message ?? 'Not a date yet'}
                    </span>
                  )}
                </div>
              )}
              <ul aria-label="Quick presets" className="flex flex-col py-1">
                {PRESETS.map((preset, index) => {
                  const presetReading = presetReadings[index]
                  const selected = query === '' && reminder.phrase === preset.phrase
                  return (
                    <li key={preset.label}>
                      <button
                        aria-pressed={selected}
                        className={cn(
                          'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
                          selected && 'bg-muted/70',
                        )}
                        onClick={() => commit(preset.phrase)}
                        type="button"
                      >
                        <span className="text-foreground">{preset.label}</span>
                        <span className="numeric-mono text-muted-foreground text-xs">
                          {presetReading?.ok ? presetReading.label : '—'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="flex items-center justify-between gap-3 border-border/60 border-t px-3 py-2 text-[11px] text-muted-foreground">
                <span>
                  Reads through <code className="font-mono">@pascal-app/lingo/date</code>
                </span>
                <span className="numeric-mono">{formatDay(now)}</span>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex min-h-[1.75rem] flex-wrap items-center gap-2">
          <Badge
            className="font-mono text-[10px] uppercase tracking-wide"
            variant={reminderReading.ok ? 'secondary' : 'outline'}
          >
            {reminderReading.ok ? 'reminder set' : 'parked'}
          </Badge>
          <span className="numeric-mono text-muted-foreground text-sm">
            {reminderReading.ok
              ? `${reminderReading.label} · ${reminder.condition}`
              : 'no date — resurfaces when you ask'}
          </span>
          {reminder.phrase ? (
            <span className="font-mono text-muted-foreground/70 text-xs">“{reminder.phrase}”</span>
          ) : null}
        </div>
      </div>
    </DemoFrame>
  )
}
