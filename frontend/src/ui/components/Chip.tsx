import { type HTMLAttributes } from 'react'
import { cn } from '../cn'

type Tone = 'neutral' | 'accent' | 'trace' | 'success' | 'danger'

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone
  interactive?: boolean
}

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-[var(--elev-1)] text-[var(--text-muted)] border-[var(--border)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_oklch,var(--accent)_24%,transparent)]',
  trace: 'bg-[var(--trace-soft)] text-[var(--trace)] border-[color-mix(in_oklch,var(--trace)_24%,transparent)]',
  success:
    'bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[var(--success)] border-[color-mix(in_oklch,var(--success)_24%,transparent)]',
  danger:
    'bg-[color-mix(in_oklch,var(--danger)_14%,transparent)] text-[var(--danger)] border-[color-mix(in_oklch,var(--danger)_24%,transparent)]',
}

export function Chip({ tone = 'neutral', interactive, className, ...rest }: Props) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium leading-none',
        interactive && 'cursor-pointer transition-[filter] duration-150 ease-out hover:brightness-[1.1]',
        toneClasses[tone],
        className,
      )}
      {...rest}
    />
  )
}
