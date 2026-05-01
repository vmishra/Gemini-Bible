import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '../cn'

type Variant = 'primary' | 'soft' | 'ghost' | 'outline'
type Size = 'sm' | 'md'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[oklch(16%_0_0)] hover:brightness-[1.04] active:brightness-[0.98] shadow-[var(--shadow-1)]',
  soft:
    'bg-[var(--elev-1)] text-[var(--text)] hover:bg-[var(--elev-2)] border border-[var(--border)]',
  ghost:
    'bg-transparent text-[var(--text-muted)] hover:bg-[var(--elev-1)] hover:text-[var(--text)]',
  outline:
    'bg-transparent text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[14px]',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'soft', size = 'sm', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium leading-none',
        'transition-[background-color,color,box-shadow,filter,border-color] duration-150 ease-out',
        'disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...rest}
    />
  )
})
