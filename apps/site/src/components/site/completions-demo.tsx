'use client'

import { type Completion, type CompletionSource, completions } from '@pascal-app/lingo/complete'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { DocsPane, DocsSplitPaneSection } from '@/components/site/docs-split-pane'
import { JsonView } from '@/components/site/json-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const EXAMPLES = ['2 f', '8 oz', '10 kg to 16', '30 min to 2', '2 h', '5'] as const
const DEBOUNCE_MS = 140
const PANEL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

type FieldKind = 'length' | 'mass' | 'duration' | 'currency' | 'off'

const SOURCE_ORDER: CompletionSource[] = [
  'parse',
  'alternative',
  'unit-ambiguity',
  'unit-prefix',
  'implied-unit',
  'range-implied',
]

const SOURCE_META: Record<CompletionSource, { label: string; hint: string; badgeClass: string }> = {
  parse: {
    label: 'Best parse',
    hint: 'Primary interpretation from the grammar',
    badgeClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  },
  alternative: {
    label: 'Alternatives',
    hint: 'Other readings (e.g. number separator ambiguity)',
    badgeClass: 'border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  },
  'unit-ambiguity': {
    label: 'Unit forks',
    hint: 'Cross-kind or ambiguous unit spellings',
    badgeClass: 'border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-100',
  },
  'unit-prefix': {
    label: 'Prefix',
    hint: 'Partial unit token expanded to full aliases',
    badgeClass: 'border-violet-500/25 bg-violet-500/10 text-violet-900 dark:text-violet-100',
  },
  'implied-unit': {
    label: 'Implied units',
    hint: 'Bare number + field kind → common units',
    badgeClass: 'border-rose-500/25 bg-rose-500/10 text-rose-900 dark:text-rose-100',
  },
  'range-implied': {
    label: 'Range units',
    hint: 'Open ranges fan out to kg, lb, m, ft, …',
    badgeClass: 'border-orange-500/25 bg-orange-500/10 text-orange-950 dark:text-orange-100',
  },
}

const DEFAULT_SOURCES = Object.fromEntries(SOURCE_ORDER.map((source) => [source, true])) as Record<
  CompletionSource,
  boolean
>

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setPending(true)
    const timer = window.setTimeout(() => {
      setDebounced(value)
      setPending(false)
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return { debounced, pending }
}

function groupBySource(items: Completion[]) {
  const buckets = new Map<CompletionSource, Completion[]>()
  for (const item of items) {
    const list = buckets.get(item.source) ?? []
    list.push(item)
    buckets.set(item.source, list)
  }
  return SOURCE_ORDER.filter((source) => buckets.has(source)).map((source) => ({
    source,
    items: buckets.get(source)!,
  }))
}

export function CompletionsDemo() {
  const listId = useId()
  const reduceMotion = useReducedMotion()
  const [value, setValue] = useState('2 f')
  const [activeIndex, setActiveIndex] = useState(0)
  const [sources, setSources] = useState(DEFAULT_SOURCES)
  const [fieldKind, setFieldKind] = useState<FieldKind>('mass')
  const [customUnits, setCustomUnits] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const { debounced: query, pending } = useDebouncedValue(value, DEBOUNCE_MS)

  const parsedUnits = useMemo(() => {
    const refs = customUnits
      .split(/[,;\s]+/)
      .map((part) => part.trim())
      .filter(Boolean)
    return refs.length > 0 ? refs : undefined
  }, [customUnits])

  const rawItems = useMemo(
    () =>
      completions(query, {
        limit: 12,
        kind: fieldKind === 'off' ? undefined : fieldKind,
        units: parsedUnits,
      }),
    [fieldKind, parsedUnits, query],
  )

  const items = useMemo(() => rawItems.filter((item) => sources[item.source]), [rawItems, sources])

  const groups = useMemo(() => groupBySource(items), [items])
  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups])

  const activeId = flatItems.length > 0 ? `${listId}-item-${Math.max(0, activeIndex)}` : undefined
  const json = useMemo(() => JSON.stringify(items, null, 2), [items])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, sources, fieldKind, customUnits])

  function pick(item: Completion) {
    setValue(item.text)
  }

  function toggleSource(source: CompletionSource) {
    setSources((current) => {
      const next = { ...current, [source]: !current[source] }
      const enabled = SOURCE_ORDER.some((key) => next[key])
      return enabled ? next : current
    })
  }

  const panelInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }
  const panelAnimate = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }
  const panelExit = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }
  const itemInitial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }
  const itemAnimate = reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }

  return (
    <DocsSplitPaneSection aria-labelledby="completions-demo-title">
      <DocsPane>
        <div className="flex flex-col gap-1">
          <h3
            className="font-[525] text-[13px] text-foreground leading-none"
            id="completions-demo-title"
          >
            Autocomplete anything
          </h3>
          <p className="text-muted-foreground text-sm">
            Ranked canonical readings — debounced as you type, grouped by how each completion was
            derived.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-[10px] border border-border/60 bg-muted/20 p-3">
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs">Field context</Label>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['mass', 'Mass field'],
                  ['length', 'Length field'],
                  ['duration', 'Duration field'],
                  ['currency', 'Currency field'],
                  ['off', 'No kind'],
                ] as const
              ).map(([kind, label]) => (
                <Button
                  aria-pressed={fieldKind === kind}
                  className="h-7 rounded-full px-2.5 text-xs shadow-none"
                  key={kind}
                  onClick={() => setFieldKind(kind)}
                  size="sm"
                  type="button"
                  variant={fieldKind === kind ? 'secondary' : 'outline'}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Kind biases implied units. Ranges inherit the left unit (e.g. kg) even when the field
              kind differs.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs" htmlFor={`${listId}-units`}>
              Suggested units (optional)
            </Label>
            <Input
              className="h-9 rounded-[6px] font-mono text-sm"
              id={`${listId}-units`}
              onChange={(event) => setCustomUnits(event.target.value)}
              placeholder="kg, lb, m, ft"
              value={customUnits}
            />
            <p className="text-muted-foreground text-xs">
              Overrides kind defaults — useful for optimistic bare-number suggestions without a
              field kind.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs">Show categories</Label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_ORDER.map((source) => {
                const meta = SOURCE_META[source]
                const on = sources[source]
                return (
                  <Button
                    aria-pressed={on}
                    className={cn(
                      'h-7 rounded-full px-2.5 text-xs shadow-none',
                      on && meta.badgeClass,
                    )}
                    key={source}
                    onClick={() => toggleSource(source)}
                    size="sm"
                    title={meta.hint}
                    type="button"
                    variant={on ? 'secondary' : 'outline'}
                  >
                    {meta.label}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="relative flex flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <Label htmlFor="completions-input">Type a partial value</Label>
            <span
              aria-live="polite"
              className={cn(
                'font-mono text-[10px] text-muted-foreground uppercase transition-opacity duration-150',
                pending ? 'opacity-100' : 'opacity-0',
              )}
            >
              Updating…
            </span>
          </div>
          <Input
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-busy={pending}
            aria-controls={listId}
            aria-expanded={flatItems.length > 0}
            autoComplete="off"
            className="h-11 rounded-[6px] text-base"
            id="completions-input"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (flatItems.length === 0) {
                return
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((index) => Math.min(index + 1, flatItems.length - 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              }
              if (event.key === 'Enter' && flatItems[activeIndex]) {
                event.preventDefault()
                pick(flatItems[activeIndex]!)
              }
            }}
            role="combobox"
            value={value}
          />

          <AnimatePresence initial={false} mode="popLayout">
            {flatItems.length > 0 ? (
              <m.div
                animate={panelAnimate}
                className={cn(
                  'flex max-h-72 flex-col overflow-hidden rounded-[8px] border border-border/70 bg-background shadow-sm transition-opacity duration-150',
                  pending && 'opacity-70',
                )}
                exit={panelExit}
                id={listId}
                initial={panelInitial}
                key="panel"
                ref={listRef}
                role="listbox"
                transition={{ duration: 0.16, ease: PANEL_EASE }}
              >
                <div className="flex max-h-72 flex-col gap-2 overflow-y-auto p-1.5">
                  {groups.map((group) => {
                    const meta = SOURCE_META[group.source]
                    let offset = 0
                    for (const g of groups) {
                      if (g.source === group.source) {
                        break
                      }
                      offset += g.items.length
                    }
                    return (
                      <section
                        aria-label={meta.label}
                        className="flex flex-col gap-1"
                        key={group.source}
                      >
                        <div className="flex items-center justify-between px-2 pt-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={cn('h-5 border px-1.5 text-[10px]', meta.badgeClass)}
                              variant="outline"
                            >
                              {meta.label}
                            </Badge>
                            <span className="text-muted-foreground text-xs">{meta.hint}</span>
                          </div>
                          <span className="numeric-mono text-[10px] text-muted-foreground">
                            {group.items.length}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {group.items.map((item, index) => {
                            const flatIndex = offset + index
                            return (
                              <m.div
                                animate={itemAnimate}
                                initial={itemInitial}
                                key={`${group.source}-${item.text}`}
                                layout={reduceMotion ? false : 'position'}
                                transition={{
                                  duration: 0.14,
                                  ease: PANEL_EASE,
                                  delay: reduceMotion ? 0 : index * 0.02,
                                }}
                              >
                                <Button
                                  aria-selected={activeIndex === flatIndex}
                                  className={cn(
                                    'h-auto min-h-10 w-full justify-between gap-3 whitespace-normal rounded-[6px] px-3 py-2 text-left font-normal shadow-none',
                                    activeIndex === flatIndex ? 'bg-muted/70' : 'hover:bg-muted/45',
                                  )}
                                  id={`${listId}-item-${flatIndex}`}
                                  onClick={() => pick(item)}
                                  onMouseEnter={() => setActiveIndex(flatIndex)}
                                  role="option"
                                  tabIndex={-1}
                                  type="button"
                                  variant="ghost"
                                >
                                  <span className="min-w-0 truncate font-medium text-foreground text-sm">
                                    {item.text}
                                  </span>
                                  <span className="numeric-mono shrink-0 text-[10px] text-muted-foreground">
                                    {item.confidence.toFixed(2)}
                                  </span>
                                </Button>
                              </m.div>
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </m.div>
            ) : (
              <m.p
                animate={{ opacity: 1 }}
                className="text-muted-foreground text-sm"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
                key="empty"
                transition={{ duration: 0.12 }}
              >
                {pending
                  ? 'Waiting for input to settle…'
                  : query.trim() === ''
                    ? 'Type to see completions.'
                    : 'No completions match the current filters.'}
              </m.p>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <Button
              key={example}
              onClick={() => setValue(example)}
              size="sm"
              type="button"
              variant={value === example ? 'secondary' : 'outline'}
            >
              {example}
            </Button>
          ))}
        </div>
      </DocsPane>

      <JsonView
        className="h-full"
        heightClassName="h-[32rem]"
        label="Completions JSON"
        value={json}
      />
    </DocsSplitPaneSection>
  )
}
