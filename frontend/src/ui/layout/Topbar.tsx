import { Moon, Sun } from 'lucide-react'
import { useAuth } from '../../state/auth'
import { useTheme } from '../../state/theme'
import { useRoute, type Route } from '../../state/route'
import { Chip } from '../components/Chip'
import { Kbd } from '../components/Kbd'
import { StatusDot } from '../components/StatusDot'
import { cn } from '../cn'

export function Topbar() {
  const { snapshot, status } = useAuth()
  const { theme, toggle } = useTheme()

  const ai = snapshot?.ai_studio.available ?? false
  const vx = snapshot?.vertex.available ?? false
  const dot: 'offline' | 'online' | 'active' =
    status === 'loading' ? 'active' : ai || vx ? 'online' : 'offline'

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-5 border-b border-[var(--border)] bg-[var(--surface)] px-5"
      style={{ position: 'relative' }}
    >
      <button
        type="button"
        onClick={() => useRoute.getState().go('home')}
        className="group flex items-center gap-2"
        aria-label="Gemini Bible — home"
      >
        <SparkMark />
        <span
          className="font-display text-[19px] leading-none tracking-[-0.005em]"
          style={{ fontWeight: 500 }}
        >
          Gemini Bible
        </span>
        <span
          className="numeric ml-1 font-mono text-[10px] text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.18em' }}
        >
          v0.1
        </span>
      </button>

      <nav className="ml-2 flex items-center gap-0.5">
        <NavLink route="home" label="Home" />
        <NavLink route="practices" label="Practices" />
        <NavLink route="calculator" label="Calculator" />
        <NavLink route="tune" label="Tune" />
        <NavLink route="samples" label="Samples" />
      </nav>

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

/**
 * Inline SVG of a 4-pointed concave star — the Gemini-style spark mark,
 * vector + theme-aware. Replaces the previous PNG thumbnail which
 * rasterized poorly at 20 px and read as a pasted-in screenshot rather
 * than part of our design language.
 */
function SparkMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 transition-transform duration-200 group-hover:rotate-90"
      style={{ color: 'var(--accent)' }}
    >
      <path
        d="M12 2 C12 7 8 11 2 12 C8 13 12 17 12 22 C12 17 16 13 22 12 C16 11 12 7 12 2 Z"
        fill="currentColor"
      />
    </svg>
  )
}

function NavLink({ route, label }: { route: Route; label: string }) {
  const current = useRoute((s) => s.route)
  const go = useRoute((s) => s.go)
  const active = current === route
  return (
    <button
      type="button"
      onClick={() => go(route)}
      className={cn(
        'relative rounded-[var(--radius-sm)] px-3 py-1.5 text-[13.5px] transition-colors',
        active
          ? 'text-[var(--text)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text)]',
      )}
    >
      {label}
      <span
        aria-hidden
        className={cn(
          'absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full transition-all duration-200',
          active
            ? 'bg-[var(--accent)] opacity-100'
            : 'bg-[var(--text-muted)] opacity-0 group-hover:opacity-40',
        )}
      />
    </button>
  )
}
