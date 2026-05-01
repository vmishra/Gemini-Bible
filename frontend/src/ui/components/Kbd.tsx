import { type HTMLAttributes } from 'react'
import { cn } from '../cn'

export function Kbd({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center rounded-[6px] border border-[var(--border)]',
        'bg-[var(--surface-raised)] px-1.5 font-mono text-[10.5px] text-[var(--text-muted)]',
        className,
      )}
      {...rest}
    />
  )
}
