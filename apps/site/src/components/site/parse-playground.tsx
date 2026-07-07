'use client'

import { lingo, partialState } from '@pascal-app/lingo'
import { useEffect, useMemo, useRef, useState } from 'react'

import { DocsPane, DocsSplitPaneSection } from '@/components/site/docs-split-pane'
import { JsonView } from '@/components/site/json-view'
import { Readout } from '@/components/site/readout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { resultToPlain } from '@/lib/lingo-display'
import { cn } from '@/lib/utils'

const EXAMPLES = ['2 ft', '72 in to cm', 'between 5 and 10 kg', '5 meterz', "it's hot"] as const

export function ParsePlayground() {
  const [value, setValue] = useState('72 in to cm')
  const [commitAttempt, setCommitAttempt] = useState(0)
  const [shake, setShake] = useState(false)
  const options = useMemo(
    () => ({
      kind: value.toLowerCase().includes('hot') ? 'temperature' : undefined,
    }),
    [value],
  )
  const result = useMemo(() => lingo(value, options), [options, value])
  const state = useMemo(() => partialState(value, options), [options, value])
  const resultJson = useMemo(() => JSON.stringify(resultToPlain(result), null, 2), [result])
  const committedError = commitAttempt > 0 && !result.ok

  const shakeFrameRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (shakeFrameRef.current !== null) {
        window.cancelAnimationFrame(shakeFrameRef.current)
      }
    },
    [],
  )

  // Shake is a commit-time pulse, not derived state: reset then re-set on the
  // next frame so the CSS animation restarts on every failed attempt.
  function pulseShake() {
    setShake(false)
    if (shakeFrameRef.current !== null) {
      window.cancelAnimationFrame(shakeFrameRef.current)
    }
    shakeFrameRef.current = window.requestAnimationFrame(() => {
      shakeFrameRef.current = null
      setShake(true)
    })
  }

  function commit() {
    if (result.ok) {
      setShake(false)
    } else {
      setCommitAttempt((count) => count + 1)
      pulseShake()
    }
  }

  return (
    <DocsSplitPaneSection aria-labelledby="parse-playground-title">
      <DocsPane>
        <div className="flex flex-col gap-1">
          <h3
            className="font-[525] text-[13px] text-foreground leading-none"
            id="parse-playground-title"
          >
            Parse readout
          </h3>
          <p className="text-muted-foreground text-sm">
            Warnings can succeed; only errors block the value.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Label htmlFor="parse-input">Try a parse</Label>
          <Input
            aria-describedby="parse-state parse-error"
            aria-invalid={committedError}
            autoComplete="off"
            className={cn('parse-input h-11 rounded-[6px] text-base')}
            data-parse-shake={shake}
            data-parse-state={committedError ? 'error' : result.ok ? 'success' : 'idle'}
            id="parse-input"
            name="parse-input"
            onBlur={commit}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit()
              }
            }}
            value={value}
          />
          <div className="flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-muted-foreground" id="parse-state">
              state: <span className="numeric-mono text-foreground">{state}</span>
            </span>
            <span className="text-destructive" id="parse-error">
              {committedError ? result.issues[0]?.message : ''}
            </span>
          </div>
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

        <Readout className="min-w-0" result={result} showJson={false} surface="plain" />
      </DocsPane>

      <JsonView
        className="h-full"
        heightClassName="h-[32rem]"
        label="Raw JSON"
        value={resultJson}
      />
    </DocsSplitPaneSection>
  )
}
