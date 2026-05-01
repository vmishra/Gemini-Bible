import { cn } from '../cn'

type Props = {
  state: 'offline' | 'online' | 'active'
  className?: string
}

const colorByState: Record<Props['state'], string> = {
  offline: 'bg-[var(--border-strong)]',
  online: 'bg-[var(--success)]',
  active: 'bg-[var(--accent)]',
}

export function StatusDot({ state, className }: Props) {
  return (
    <span className={cn('relative inline-flex h-2 w-2 items-center justify-center', className)}>
      <span className={cn('h-2 w-2 rounded-full', colorByState[state])} />
      {state === 'active' && (
        <span
          className={cn(
            'absolute inline-flex h-2 w-2 rounded-full opacity-60',
            colorByState[state],
          )}
          style={{ animation: 'gb-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite' }}
        />
      )}
      <style>{`@keyframes gb-ping { 0% { transform: scale(1); opacity: 0.6 } 75%, 100% { transform: scale(2.6); opacity: 0 } }`}</style>
    </span>
  )
}
