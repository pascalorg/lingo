'use client'

import { type FoundQuantity, findQuantities } from '@pascal-app/lingo'
import {
  ActivityIcon,
  BotIcon,
  CloudIcon,
  FolderGit2Icon,
  HammerIcon,
  type LucideIcon,
  PackageIcon,
  TicketIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { DemoFrame } from '@/components/site/demo-frame'
import { JsonView } from '@/components/site/json-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { issueClass } from '@/lib/lingo-display'
import { cn } from '@/lib/utils'

interface Entity {
  icon: LucideIcon
  role: 'entity' | 'agent' | 'target'
  text: string
}

interface Rule {
  /** Hand-labelled nouns — the part a rules engine supplies. Lingo only owns
   *  the numbers, so these are shown as plain chips, never as parse output. */
  entities: readonly Entity[]
  id: string
  prompt: string
}

/** The last rule has no threshold on purpose: an event-only trigger is a
 *  legitimate reading, and the readout should say so rather than invent one. */
const RULES: readonly Rule[] = [
  {
    id: 'credits',
    prompt: 'Let me know when cloud credits fall below $10k',
    entities: [{ icon: CloudIcon, role: 'entity', text: 'cloud credits' }],
  },
  {
    id: 'build',
    prompt: 'Alert me if the build takes over 15 minutes',
    entities: [{ icon: HammerIcon, role: 'entity', text: 'the build' }],
  },
  {
    id: 'tickets',
    prompt: 'Escalate tickets that stay open for more than 3 days',
    entities: [{ icon: TicketIcon, role: 'entity', text: 'tickets' }],
  },
  {
    id: 'errors',
    prompt: 'Page me when the error rate is above 2% for 10 minutes',
    entities: [{ icon: ActivityIcon, role: 'entity', text: 'error rate' }],
  },
  {
    id: 'release',
    prompt: 'When the framework ships a new release, ask the assistant to upgrade my repos',
    entities: [
      { icon: PackageIcon, role: 'entity', text: 'framework' },
      { icon: BotIcon, role: 'agent', text: 'assistant' },
      { icon: FolderGit2Icon, role: 'target', text: 'repos' },
    ],
  },
]

type Segment =
  | { end: number; kind: 'plain'; start: number }
  | { end: number; entity: Entity; kind: 'entity'; start: number }
  | { end: number; hit: FoundQuantity; kind: 'bound'; start: number }

/** Bare numbers ("25" in "under 25 units") are not thresholds. */
function bounds(text: string): FoundQuantity[] {
  return findQuantities(text).filter((hit) => hit.result.type !== 'number')
}

function segment(text: string, rule: Rule | undefined, hits: FoundQuantity[]): Segment[] {
  const marks: Segment[] = hits.map((hit) => ({
    end: hit.span.end,
    hit,
    kind: 'bound',
    start: hit.span.start,
  }))
  for (const entity of rule?.entities ?? []) {
    const start = text.indexOf(entity.text)
    if (start >= 0) {
      const end = start + entity.text.length
      if (marks.every((m) => end <= m.start || start >= m.end)) {
        marks.push({ end, entity, kind: 'entity', start })
      }
    }
  }
  marks.sort((a, b) => a.start - b.start)
  const out: Segment[] = []
  let cursor = 0
  for (const mark of marks) {
    if (mark.start > cursor) {
      out.push({ end: mark.start, kind: 'plain', start: cursor })
    }
    out.push(mark)
    cursor = mark.end
  }
  if (cursor < text.length) {
    out.push({ end: text.length, kind: 'plain', start: cursor })
  }
  return out
}

function describe(hit: FoundQuantity): { kind: string; value: string } {
  const { result } = hit
  switch (result.type) {
    case 'range':
      return { kind: result.range.kind, value: result.range.format({ grouping: true }) }
    case 'quantity':
      return { kind: result.quantity.kind, value: result.quantity.format({ grouping: true }) }
    case 'conversion':
      return { kind: result.converted.kind, value: result.converted.format({ grouping: true }) }
    default:
      return { kind: result.type, value: hit.result.text.slice(hit.span.start, hit.span.end) }
  }
}

export function WorkflowTriggerBlock() {
  const [text, setText] = useState(RULES[0]!.prompt)
  const rule = useMemo(() => RULES.find((r) => r.prompt === text), [text])
  const hits = useMemo(() => bounds(text), [text])
  const segments = useMemo(() => segment(text, rule, hits), [text, rule, hits])

  return (
    <DemoFrame
      caption="A rules engine names the nouns; findQuantities pulls the thresholds, with spans and issues."
      details={
        <JsonView
          label="Output"
          value={JSON.stringify(
            hits.map((hit) => ({ span: hit.span, result: hit.result })),
            null,
            2,
          )}
        />
      }
      detailsLabel="Output"
      stageClassName="min-h-[26rem] justify-start"
      title="Workflow rule"
    >
      <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Input
            aria-label="Automation rule in plain words"
            className="h-11 rounded-[6px] font-mono text-base"
            onChange={(event) => setText(event.target.value)}
            placeholder="Let me know when cloud credits fall below $10k"
            spellCheck={false}
            value={text}
          />
          <div aria-label="Sample rules" className="flex flex-wrap gap-1.5" role="group">
            {RULES.map((sample) => (
              <Button
                aria-pressed={sample.id === rule?.id}
                className="h-6 rounded-[5px] px-2 font-mono text-[11px]"
                key={sample.id}
                onClick={() => setText(sample.prompt)}
                size="xs"
                type="button"
                variant={sample.id === rule?.id ? 'secondary' : 'ghost'}
              >
                {sample.id}
              </Button>
            ))}
          </div>
        </div>

        <div
          aria-hidden
          className="corner-smooth flex min-h-[3.25rem] flex-wrap items-center gap-y-1.5 rounded-[10px] bg-muted/40 px-3 py-2.5 text-[15px] leading-7"
        >
          {segments.length === 0 ? (
            <span className="text-muted-foreground/60">Type a rule</span>
          ) : (
            segments.map((seg) => {
              const slice = text.slice(seg.start, seg.end)
              if (seg.kind === 'plain') {
                return (
                  <span className="whitespace-pre-wrap text-foreground/70" key={`${seg.start}-p`}>
                    {slice}
                  </span>
                )
              }
              if (seg.kind === 'entity') {
                const Icon = seg.entity.icon
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-[5px] border border-border-strong bg-card px-1.5 py-px font-medium text-foreground shadow-raise-sm"
                    key={`${seg.start}-e`}
                  >
                    <Icon aria-hidden className="size-3 text-muted-foreground" />
                    {slice}
                  </span>
                )
              }
              return (
                <span
                  className="token-chip rounded-[5px] border px-1.5 py-px font-mono"
                  data-token="quantity"
                  key={`${seg.start}-b`}
                >
                  {slice}
                </span>
              )
            })
          )}
        </div>

        <ul
          aria-label="Extracted thresholds"
          className="corner-smooth divide-y divide-border/60 rounded-[10px] border border-border/60"
        >
          {hits.length === 0 ? (
            <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <Badge className="font-mono text-[10px] uppercase tracking-wide" variant="outline">
                event only
              </Badge>
              <span className="text-muted-foreground">
                No numeric bound in this rule — it fires on an event, not a threshold.
              </span>
            </li>
          ) : (
            hits.map((hit) => {
              const { kind, value } = describe(hit)
              return (
                <li
                  className="flex flex-col gap-1.5 px-3 py-2 text-sm"
                  key={`${hit.span.start}-${hit.span.end}`}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      aria-hidden
                      className="token-dot size-2 shrink-0 rounded-full"
                      data-token="quantity"
                    />
                    <span className="font-mono text-foreground">
                      {text.slice(hit.span.start, hit.span.end)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wide">
                      {kind} · [{hit.span.start}, {hit.span.end})
                    </span>
                    <span className="numeric-mono ml-auto text-foreground">{value}</span>
                  </div>
                  {hit.result.issues.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5 pl-5">
                      {hit.result.issues.map((issue) => (
                        <li
                          className={cn(
                            'inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-px text-xs',
                            issueClass(issue.severity),
                          )}
                          key={`${issue.code}-${issue.span?.start ?? 0}`}
                        >
                          <span className="font-mono text-[10px] uppercase">{issue.code}</span>
                          <span>{issue.message}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>

        <p className="text-muted-foreground text-xs">
          Spans index the original string, so the chips above are sliced from it — no re-tokenizing
          on the way to the UI. Edit the rule to see the bound move or disappear.
        </p>
      </div>
    </DemoFrame>
  )
}
