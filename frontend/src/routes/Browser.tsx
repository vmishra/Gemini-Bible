import { useMemo } from 'react'
import { useSamples } from '../state/samples'
import { cn } from '../ui/cn'

export function Browser() {
  const { samples, selectedId, select, status } = useSamples()

  const grouped = useMemo(() => {
    const out = new Map<string, typeof samples>()
    for (const s of samples) {
      const list = out.get(s.category) ?? []
      list.push(s)
      out.set(s.category, list)
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [samples])

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="flex h-10 items-center px-5">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          samples
        </span>
      </div>

      {status === 'loading' && (
        <div className="px-5 text-[13px] text-[var(--text-subtle)]">…</div>
      )}

      <nav className="flex-1 overflow-y-auto pb-6">
        {grouped.map(([category, list]) => (
          <div key={category} className="mt-4">
            <div className="px-5 pb-2">
              <span
                className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.28em' }}
              >
                {category}
              </span>
            </div>
            <ul>
              {list.map((s) => {
                const active = s.id === selectedId
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => void select(s.id)}
                      className={cn(
                        'group block w-full px-5 py-2 text-left transition-colors',
                        active
                          ? 'bg-[var(--accent-soft)] text-[var(--text)]'
                          : 'hover:bg-[var(--elev-1)] text-[var(--text-muted)]',
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13px] font-medium leading-tight">
                          {s.title}
                        </span>
                        <span
                          className={cn(
                            'font-mono text-[10px] uppercase',
                            active ? 'text-[var(--accent)]' : 'text-[var(--text-subtle)]',
                          )}
                          style={{ letterSpacing: '0.18em' }}
                        >
                          {s.scenario}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12px] text-[var(--text-subtle)]">
                        {s.summary}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
