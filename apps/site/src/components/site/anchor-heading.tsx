import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function SectionHeading({
  id,
  children,
  kicker,
}: {
  id: string
  children: ReactNode
  kicker?: string
}) {
  return (
    <div>
      <h2 className="group scroll-mt-20 font-semibold text-[14px] tracking-tight" id={id}>
        <Link
          className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href={`#${id}`}
        >
          {kicker ? (
            <span className="font-medium font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
              {kicker}
            </span>
          ) : null}
          {children}
          <span
            aria-hidden="true"
            className="text-muted-foreground opacity-0 transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-out)] group-focus-within:opacity-100 group-hover:opacity-100"
          >
            #
          </span>
        </Link>
      </h2>
    </div>
  )
}

export function SubHeading({
  id,
  children,
  className,
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  return (
    <h3
      className={cn('group scroll-mt-20 font-semibold text-[14px] tracking-tight', className)}
      id={id}
    >
      <Link
        className="inline-flex items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        href={`#${id}`}
      >
        {children}
        <span
          aria-hidden="true"
          className="text-muted-foreground opacity-0 transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-out)] group-focus-within:opacity-100 group-hover:opacity-100"
        >
          #
        </span>
      </Link>
    </h3>
  )
}
