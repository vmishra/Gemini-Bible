import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useSamples, type Sample } from '../state/samples'
import { Kbd } from '../ui/components/Kbd'
import { cn } from '../ui/cn'

const CATEGORY_ORDER = ['text', 'live', 'image', 'video', 'embeddings'] as const

const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  text: 'text',
  live: 'live',
  image: 'image',
  video: 'video',
  embeddings: 'embeddings',
}

export function Browser() {
  const { samples, selectedId, select } = useSamples()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Cmd/Ctrl-K focuses the search input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return samples
    return samples.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.scenario.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q),
    )
  }, [samples, query])

  const grouped = useMemo(() => {
    const map = new Map<string, Sample[]>()
    for (const s of filtered) {
      const list = map.get(s.category) ?? []
      list.push(s)
      map.set(s.category, list)
    }
    const known = CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const)
    const unknown = [...map.keys()]
      .filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c))
      .sort()
      .map((c) => [c, map.get(c)!] as const)
    return [...known, ...unknown]
  }, [filtered])

  return (
    <aside className="flex w-[320px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="px-4 pt-4 pb-3">
        <label
          className={cn(
            'flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)]',
            'bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-muted)]',
            'transition-colors focus-within:border-[var(--border-strong)]',
          )}
        >
          <Search size={14} strokeWidth={1.5} className="shrink-0 text-[var(--text-subtle)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search samples"
            className="min-w-0 flex-1 bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
              style={{ letterSpacing: '0.18em' }}
            >
              clear
            </button>
          ) : (
            <span className="flex shrink-0 items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          )}
        </label>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto pb-6">
        {grouped.length === 0 && (
          <div className="px-4 pt-6 text-center text-[13px] text-[var(--text-subtle)]">
            nothing matches
          </div>
        )}

        {grouped.map(([category, list]) => (
          <section key={category} className="mt-2 first:mt-0">
            <div
              className="sticky top-0 z-10 flex items-baseline justify-between bg-[var(--surface)]/95 px-4 py-2 backdrop-blur-sm"
            >
              <span
                className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.28em' }}
              >
                {CATEGORY_LABEL[category as (typeof CATEGORY_ORDER)[number]] ?? category}
              </span>
              <span className="numeric font-mono text-[10.5px] text-[var(--text-subtle)]">
                {list.length}
              </span>
            </div>
            <ul>
              {list.map((s) => {
                const active = s.id === selectedId
                return (
                  <li key={s.id}>
                    <button
                      onClick={() => void select(s.id)}
                      title={s.summary}
                      className={cn(
                        'group relative flex w-full items-center justify-between gap-3 px-4 py-1.5 text-left',
                        'transition-colors',
                        active
                          ? 'bg-[var(--elev-1)] text-[var(--text)]'
                          : 'text-[var(--text-muted)] hover:bg-[var(--elev-1)] hover:text-[var(--text)]',
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full',
                          active ? 'bg-[var(--accent)]' : 'bg-transparent',
                        )}
                      />
                      <span className="truncate text-[13px] leading-tight">{s.title}</span>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-[10px] uppercase opacity-0 transition-opacity',
                          'group-hover:opacity-100',
                          active && 'opacity-100',
                          active ? 'text-[var(--accent)]' : 'text-[var(--text-subtle)]',
                        )}
                        style={{ letterSpacing: '0.18em' }}
                      >
                        {s.scenario}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </nav>

      <footer className="border-t border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.28em' }}
          >
            {samples.length} samples
          </span>
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.28em' }}
          >
            v0.1
          </span>
        </div>
      </footer>
    </aside>
  )
}
