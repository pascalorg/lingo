'use client'

import { findQuantities, parseRange } from '@pascal-app/lingo'
import { CheckCircle2Icon, FilterIcon, SparklesIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { cn } from '@/lib/utils'

interface WorkflowRule {
  id: string
  prompt: string
  title: string
  tokens: Array<{
    text: string
    type: 'entity' | 'agent' | 'condition' | 'target' | 'plain'
    brand?: 'nextjs' | 'claude' | 'github' | 'aws' | 'x' | 'gmail' | 'gdrive'
    iconText?: string
  }>
}

const SAMPLE_RULES: WorkflowRule[] = [
  {
    id: 'nextjs-claude',
    title: 'Framework Auto-Upgrade',
    prompt: 'When nextjs comes up with a new release, ask claude to upgrade my repos',
    tokens: [
      { text: 'When', type: 'plain' },
      { text: 'nextjs', type: 'entity', brand: 'nextjs' },
      { text: 'comes up with a new release, ask', type: 'plain' },
      { text: 'claude', type: 'agent', brand: 'claude' },
      { text: 'to upgrade my', type: 'plain' },
      { text: 'repos', type: 'target', brand: 'github' },
    ],
  },
  {
    id: 'aws-credits',
    title: 'Spend & Cloud Credits Guardrail',
    prompt: 'Let me know when AWS credits fall below $10k',
    tokens: [
      { text: 'Let me know when', type: 'plain' },
      { text: 'AWS credits', type: 'entity', brand: 'aws' },
      { text: 'fall', type: 'plain' },
      { text: 'below $10k', type: 'condition' },
    ],
  },
  {
    id: 'bug-triage',
    title: 'Omnichannel Bug Routing',
    prompt: 'Catch when someone reports a bug on X or by email and have Anton fix it',
    tokens: [
      { text: 'Catch when someone', type: 'plain' },
      { text: 'reports a bug', type: 'condition' },
      { text: 'on', type: 'plain' },
      { text: 'X', type: 'entity', brand: 'x' },
      { text: 'or by', type: 'plain' },
      { text: 'email', type: 'entity', brand: 'gmail' },
      { text: 'and have', type: 'plain' },
      { text: 'Anton', type: 'agent', iconText: '🐞' },
      { text: 'fix it', type: 'plain' },
    ],
  },
  {
    id: 'gdrive-archive',
    title: 'Document Filing & Vault',
    prompt: 'Can you save administrative emails I receive to this Google drive folder',
    tokens: [
      { text: 'Can you save administrative', type: 'plain' },
      { text: 'emails', type: 'entity', brand: 'gmail' },
      { text: 'I receive to this', type: 'plain' },
      { text: 'Google drive folder', type: 'target', brand: 'gdrive' },
    ],
  },
]

export function WorkflowTriggerBlock() {
  const [selectedRuleId, setSelectedRuleId] = useState<string>('aws-credits')
  const [customText, setCustomText] = useState('Let me know when AWS credits fall below $10k')

  // Parse any condition / quantities inside the rule text with Lingo
  const parsedCondition = useMemo(() => {
    // 1. Try finding range/bounds ("below $10k", "over 50 kg")
    const rangeRes = parseRange(customText, { kind: 'currency' })
    if (rangeRes.ok) {
      const minQty = rangeRes.range.min()
      const maxQty = rangeRes.range.max()
      return {
        type: 'range' as const,
        min: minQty ? minQty.format() : null,
        max: maxQty ? maxQty.format() : null,
        canonicalMax: maxQty ? maxQty.base : null,
      }
    }
    // 2. Scan free text for quantities
    const found = findQuantities(customText)
    if (found.length > 0) {
      return {
        type: 'quantities' as const,
        items: found.map((f) => ({
          text: f.result.text,
          canonical:
            f.result.type === 'quantity'
              ? `${f.result.quantity.base} ${f.result.quantity.unit}`
              : f.result.text,
        })),
      }
    }
    return null
  }, [customText])

  const currentRule = SAMPLE_RULES.find((r) => r.id === selectedRuleId) ?? SAMPLE_RULES[1]!

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h3 className="font-semibold text-2xl text-foreground tracking-tight sm:text-3xl">
          Natural Language Workflow Triggers
        </h3>
        <p className="max-w-xl text-muted-foreground text-sm sm:text-base">
          Parse human automation rules into typed entity targets and numerical triggers with
          Lingo&apos;s free-text quantity and range extractor.
        </p>
      </div>

      {/* Visual Canvas containing Interactive Rules modeled after Reference 3 */}
      <div className="flex flex-col gap-8 rounded-2xl border border-border/80 bg-card p-6 shadow-raise-sm sm:p-8">
        <div className="flex flex-col gap-6">
          {SAMPLE_RULES.map((rule) => {
            const isSelected = selectedRuleId === rule.id
            return (
              <button
                className={cn(
                  'w-full cursor-pointer rounded-xl border p-4 text-left text-base leading-loose transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 sm:text-lg',
                  isSelected
                    ? 'border-primary/50 bg-primary/5 shadow-sm'
                    : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40',
                )}
                key={rule.id}
                onClick={() => {
                  setSelectedRuleId(rule.id)
                  setCustomText(rule.prompt)
                }}
                type="button"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-3 font-normal">
                  {rule.tokens.map((token, tIdx) => {
                    if (token.type === 'plain') {
                      return (
                        <span className="text-foreground" key={tIdx}>
                          {token.text}
                        </span>
                      )
                    }

                    // Entity / Action / Agent styling matching reference 3
                    if (token.type === 'entity') {
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200/80 bg-orange-50 px-2 py-0.5 font-semibold text-orange-900 text-sm dark:border-orange-800/60 dark:bg-orange-950/40 dark:text-orange-200"
                          key={tIdx}
                        >
                          {token.brand === 'nextjs' && (
                            <span className="flex size-4 items-center justify-center rounded-full bg-black font-bold text-[10px] text-white">
                              N
                            </span>
                          )}
                          {token.brand === 'aws' && (
                            <span className="rounded bg-amber-400 px-1 font-bold font-mono text-[10px] text-black">
                              aws
                            </span>
                          )}
                          {token.brand === 'x' && (
                            <span className="flex size-4 items-center justify-center rounded bg-black font-bold text-[10px] text-white">
                              𝕏
                            </span>
                          )}
                          {token.brand === 'gmail' && (
                            <span className="font-bold text-red-500 text-xs">M</span>
                          )}
                          <span>{token.text}</span>
                        </span>
                      )
                    }

                    if (token.type === 'agent') {
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/80 bg-rose-50 px-2 py-0.5 font-semibold text-rose-900 text-sm dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
                          key={tIdx}
                        >
                          {token.brand === 'claude' && <span>✳️</span>}
                          {token.iconText && <span>{token.iconText}</span>}
                          <span>{token.text}</span>
                        </span>
                      )
                    }

                    if (token.type === 'condition') {
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200/80 bg-blue-50 px-2 py-0.5 font-semibold text-blue-900 text-sm dark:border-blue-800/60 dark:bg-blue-950/40 dark:text-blue-200"
                          key={tIdx}
                        >
                          {token.text.includes('below') ? (
                            <FilterIcon className="size-3 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <SparklesIcon className="size-3 text-blue-600 dark:text-blue-400" />
                          )}
                          <span>{token.text}</span>
                        </span>
                      )
                    }

                    if (token.type === 'target') {
                      return (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-100 px-2 py-0.5 font-semibold text-sm text-stone-900 dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-200"
                          key={tIdx}
                        >
                          {token.brand === 'github' && (
                            <span className="flex size-3.5 items-center justify-center">🐙</span>
                          )}
                          {token.brand === 'gdrive' && (
                            <span className="flex size-3.5 items-center justify-center">📁</span>
                          )}
                          <span>{token.text}</span>
                        </span>
                      )
                    }

                    return <span key={tIdx}>{token.text}</span>
                  })}
                </div>
              </button>
            )
          })}
        </div>

        {/* Lingo Canonicalization Inspector */}
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/40 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-mono font-semibold text-muted-foreground text-xs uppercase tracking-wider">
              <CheckCircle2Icon className="size-4 text-emerald-500" />
              Lingo Automated Extraction Readout
            </span>
            <span className="font-mono text-muted-foreground text-xs">
              Active Rule: {currentRule.title}
            </span>
          </div>

          <div className="mt-1 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background p-3">
              <span className="font-medium text-muted-foreground text-xs">Original Prompt</span>
              <span className="break-words font-mono text-foreground text-xs sm:text-sm">
                &ldquo;{customText}&rdquo;
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background p-3">
              <span className="font-medium text-muted-foreground text-xs">
                Extracted Threshold / Condition
              </span>
              <div className="font-mono text-foreground text-xs sm:text-sm">
                {parsedCondition?.type === 'range' && (
                  <div>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      Upper Bound:
                    </span>{' '}
                    {parsedCondition.max ?? '—'} (Canonical: $
                    {parsedCondition.canonicalMax?.toLocaleString()})
                  </div>
                )}
                {parsedCondition?.type === 'quantities' && (
                  <div>
                    {parsedCondition.items.map((it, i) => (
                      <span className="mr-2 inline-block" key={i}>
                        {it.text} →{' '}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {it.canonical}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
                {!parsedCondition && (
                  <span className="text-muted-foreground italic">
                    Event-driven trigger (Zero threshold)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
