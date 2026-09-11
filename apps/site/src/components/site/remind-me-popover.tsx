'use client'

import { parseDate, parseDateRange } from '@pascal-app/lingo/date'
import { CheckIcon, ChevronDownIcon, ClockIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { useHydrated } from '@/components/site/use-hydrated'
import { cn } from '@/lib/utils'

const SSR_NOW = new Date(2026, 8, 11, 19, 49, 0) // Friday Sep 11, 2026

interface PresetItem {
  compute: (now: Date) => string
  id: string
  label: string
}

const PRESET_ITEMS: PresetItem[] = [
  {
    id: 'tomorrow',
    label: 'tomorrow',
    compute: (now: Date) => {
      const res = parseDate('tomorrow at 8am', { now })
      if (res.ok) {
        const d = res.date
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
        return `${weekday}, 8:00 AM`
      }
      return 'SAT, 8:00 AM'
    },
  },
  {
    id: 'next-week',
    label: 'next week',
    compute: (now: Date) => {
      const res = parseDate('next monday at 8am', { now })
      if (res.ok) {
        const d = res.date
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
        return `${weekday}, 8:00 AM`
      }
      return 'MON, 8:00 AM'
    },
  },
  {
    id: 'this-weekend',
    label: 'this weekend',
    compute: (now: Date) => {
      const res = parseDateRange('this weekend', { now })
      if (res.ok && res.start) {
        const d = res.start.date
        const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
        return `${weekday}, 8:00 AM`
      }
      return 'SAT, 8:00 AM'
    },
  },
  {
    id: 'someday',
    label: 'someday',
    compute: () => '¯\\_(ツ)_/¯',
  },
]

export function RemindMePopoverBlock() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('tomorrow')
  const [condition, setCondition] = useState('if no reply')
  const [conditionOpen, setConditionOpen] = useState(false)
  const hydrated = useHydrated()
  const now = hydrated ? new Date() : SSR_NOW

  // Evaluate query with Lingo
  const activeCustomReading = useMemo(() => {
    if (!query.trim()) {
      return null
    }
    const range = parseDateRange(query, { now })
    if (range.ok) {
      if (range.start && range.end) {
        const s = range.start.date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
        })
        const e = range.end.date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'numeric',
          day: 'numeric',
        })
        return `${s} → ${e}`
      }
      if (range.start) {
        return `From ${range.start.date.toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`
      }
    }
    const single = parseDate(query, { now })
    if (single.ok) {
      const weekday = single.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
      const time = single.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      return `${weekday}, ${time}`
    }
    return null
  }, [query, now])

  return (
    <div className="flex w-full flex-col items-center justify-center p-2 sm:p-6">
      {/* Popover Card modeled after Reference Image 1 */}
      <div className="flex w-full max-w-[28rem] flex-col overflow-hidden rounded-2xl border border-border/80 bg-[#161618] font-sans text-[#eaeaea] shadow-raise-lg transition-all duration-200">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-white/5 border-b px-4 pt-3.5 pb-2.5">
          <ClockIcon className="size-4 text-white/50" />
          <span className="font-medium text-white/80 text-xs tracking-wide">Remind me</span>
        </div>

        {/* Input Bar & Condition Selector */}
        <div className="relative flex items-center justify-between bg-[#161618] px-4 py-3">
          <div className="flex flex-1 items-center gap-2">
            <span className="shrink-0 select-none font-mono text-sm text-white/35">Try:</span>
            <input
              className="w-full bg-transparent font-normal text-sm text-white outline-none placeholder:text-white/25"
              onChange={(e) => {
                setQuery(e.target.value)
                if (e.target.value) {
                  setSelectedId('')
                }
              }}
              placeholder="8 am, 3 days, aug 7"
              type="text"
              value={query}
            />
          </div>

          <div className="relative shrink-0">
            <button
              className="flex items-center gap-1.5 rounded px-1.5 py-1 text-white/50 text-xs transition-colors hover:text-white/80"
              onClick={() => setConditionOpen(!conditionOpen)}
              type="button"
            >
              <span>{condition}</span>
              <ChevronDownIcon className="size-3 opacity-60" />
            </button>

            {conditionOpen && (
              <div className="absolute top-full right-0 z-20 mt-1 w-36 rounded-lg border border-white/10 bg-[#222225] py-1 shadow-lg">
                {['if no reply', 'regardless', 'if unresolved'].map((item) => (
                  <button
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-white/70 text-xs hover:bg-white/10"
                    key={item}
                    onClick={() => {
                      setCondition(item)
                      setConditionOpen(false)
                    }}
                    type="button"
                  >
                    <span>{item}</span>
                    {condition === item && <CheckIcon className="size-3 text-purple-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Custom Parsed Row when user types */}
        {query.trim() && (
          <div className="flex items-center justify-between border-white/10 border-y bg-[#252528] px-4 py-2.5 text-xs">
            <span className="max-w-[12rem] truncate font-medium text-purple-300">{query}</span>
            <span className="font-mono text-purple-200">
              {activeCustomReading ?? 'Typing valid time...'}
            </span>
          </div>
        )}

        {/* Preset Options List */}
        <div className="flex flex-col py-1">
          {PRESET_ITEMS.map((item) => {
            const isSelected = selectedId === item.id && !query
            const output = item.compute(now)
            return (
              <button
                className={cn(
                  'group relative flex cursor-pointer items-center justify-between px-4 py-2.5 text-left text-xs transition-colors',
                  isSelected
                    ? 'bg-[#29292d] text-white'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                )}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id)
                  setQuery('')
                }}
                type="button"
              >
                {/* Active indicator bar on left */}
                {isSelected && (
                  <span className="absolute inset-y-0 left-0 w-1 rounded-r bg-purple-500" />
                )}
                <span className="font-normal text-white/90">{item.label}</span>
                <span className="font-mono text-[11px] text-white/45 transition-colors group-hover:text-white/70">
                  {output}
                </span>
              </button>
            )
          })}
        </div>

        {/* Bottom confirmation readout */}
        <div className="flex items-center justify-between border-white/5 border-t bg-[#121214] px-4 py-2.5 text-[11px] text-white/40">
          <span>
            Scheduled via <strong className="font-medium text-white/60">Lingo Date Engine</strong>
          </span>
          <span className="font-mono text-[10px]">
            {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    </div>
  )
}
