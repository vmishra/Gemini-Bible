import { Moon, Sun } from 'lucide-react'
import { useAuth } from '../../state/auth'
import { useTheme } from '../../state/theme'
import { Chip } from '../components/Chip'
import { Kbd } from '../components/Kbd'
import { StatusDot } from '../components/StatusDot'

export function Topbar() {
  const { snapshot, status } = useAuth()
  const { theme, toggle } = useTheme()

  const ai = snapshot?.ai_studio.available ?? false
  const vx = snapshot?.vertex.available ?? false
  const dot: 'offline' | 'online' | 'active' =
    status === 'loading' ? 'active' : ai || vx ? 'online' : 'offline'

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-5"
      style={{ position: 'relative' }}
    >
      <div className="flex items-center gap-3">
        <span className="font-display text-[18px] leading-none" style={{ fontWeight: 500 }}>
          Gemini Bible
        </span>
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          v0.1
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Chip tone={ai ? 'accent' : 'neutral'}>
          <StatusDot state={ai ? 'online' : 'offline'} />
          ai studio
        </Chip>
        <Chip tone={vx ? 'accent' : 'neutral'}>
          <StatusDot state={vx ? 'online' : 'offline'} />
          vertex
        </Chip>

        <span className="mx-2 h-5 w-px bg-[var(--border)]" />

        <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-subtle)]">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>

        <button
          aria-label="toggle theme"
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:bg-[var(--elev-1)] hover:text-[var(--text)] transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
        </button>

        <StatusDot state={dot} />
      </div>
    </header>
  )
}
