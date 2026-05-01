import { type HTMLAttributes, forwardRef } from 'react'
import { cn } from '../cn'

type Props = HTMLAttributes<HTMLDivElement> & {
  pad?: boolean
  elev?: 1 | 2
}

export const Panel = forwardRef<HTMLDivElement, Props>(function Panel(
  { className, pad = true, elev = 1, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border)]',
        elev === 1 ? 'bg-[var(--elev-1)] shadow-[var(--shadow-1)]' : 'bg-[var(--elev-2)]',
        pad && 'p-5',
        className,
      )}
      {...rest}
    />
  )
})
