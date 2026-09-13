'use client'

import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { cn } from '@/lib/utils'

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  align = 'start',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 6,
  className,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        className="isolate z-50 outline-none"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            'max-h-[var(--available-height)] w-80 max-w-[var(--available-width)] origin-[var(--transform-origin)] overflow-hidden rounded-xl bg-popover text-popover-foreground text-sm opacity-0 shadow-raise-lg outline-none ring-1 ring-foreground/10 transition-[opacity,transform] duration-[var(--motion-fast)] ease-[var(--ease-out)] data-ending-style:scale-[0.98] data-open:scale-100 data-open:opacity-100 data-starting-style:scale-[0.98]',
            className,
          )}
          data-slot="popover-content"
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      className={cn('font-[525] text-[13px] text-foreground leading-none', className)}
      data-slot="popover-title"
      {...props}
    />
  )
}

export { Popover, PopoverContent, PopoverTitle, PopoverTrigger }
