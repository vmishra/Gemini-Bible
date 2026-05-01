import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useSamples, type Sample } from '../state/samples'
import { SUPERGROUPS } from '../data/catalog'
import { Kbd } from '../ui/components/Kbd'
import { cn } from '../ui/cn'

// Order of top-level sections in the sample browser. Matches the Home page
// hierarchy: text → live → GenMedia (clustering image/video/music/speech) →
// embeddings → specialized. Anything outside this list falls in alphabetically
// at the end.
const SECTION_ORDER = ['text', 'live', 'genmedia', 'embeddings', 'specialized'] as const

const CATEGORY_LABEL: Record<string, string> = {
  text: 'Text',
  live: 'Live',
  image: 'Image',
  video: 'Video',
  music: 'Music',
  speech: 'Speech',
  embeddings: 'Embeddings',
  specialized: 'Specialized',
  genmedia: 'GenMedia',
}

type Section =
  | { kind: 'family'; id: string; label: string; samples: Sample[] }
  | {
      kind: 'supergroup'
      id: string
      label: string
      families: { id: string; label: string; samples: Sample[] }[]
      total: number
    }

export function Browser() {
  const { samples, selectedId, select } = useSamples()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  // ⌘K focuses the search; esc blurs.
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

  const sections = useMemo(() => buildSections(filtered), [filtered])

  return (
    <aside className="flex w-[336px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
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
              aria-label="clear"
              onClick={() => setQuery('')}
              className="shrink-0 text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors"
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          ) : (
            <span className="flex shrink-0 items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          )}
        </label>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto pb-4">
        {sections.length === 0 && (
          <div className="px-4 pt-6 text-center text-[13px] text-[var(--text-subtle)]">
            nothing matches
          </div>
        )}

        {sections.map((section) => (
          <SectionView
            key={section.id}
            section={section}
            selectedId={selectedId}
            onSelect={(id) => void select(id)}
          />
        ))}
      </nav>

      <footer className="border-t border-[var(--border)] px-4 py-2.5">
        <div className="flex items-center justify-between">
          <span
            className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.28em' }}
          >
            {samples.length} samples
          </span>
          <span
            className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.28em' }}
          >
            v0.1
          </span>
        </div>
      </footer>
    </aside>
  )
}

function buildSections(samples: Sample[]): Section[] {
  const byCategory = new Map<string, Sample[]>()
  for (const s of samples) {
    const list = byCategory.get(s.category) ?? []
    list.push(s)
    byCategory.set(s.category, list)
  }
  // Stable ordering inside each category — by title, scenario as tiebreak.
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.title.localeCompare(b.title) || a.scenario.localeCompare(b.scenario))
  }

  const inSupergroup = new Set(SUPERGROUPS.flatMap((sg) => sg.family_ids))
  const sgById = new Map(SUPERGROUPS.map((sg) => [sg.id, sg]))

  const out: Section[] = []
  const handled = new Set<string>()

  for (const id of SECTION_ORDER) {
    const sg = sgById.get(id)
    if (sg) {
      const families = sg.family_ids
        .map((fid) => {
          const list = byCategory.get(fid) ?? []
          return list.length > 0
            ? { id: fid, label: CATEGORY_LABEL[fid] ?? fid, samples: list }
            : null
        })
        .filter((f): f is NonNullable<typeof f> => f !== null)
      if (families.length > 0) {
        out.push({
          kind: 'supergroup',
          id: sg.id,
          label: CATEGORY_LABEL[sg.id] ?? sg.label,
          families,
          total: families.reduce((n, f) => n + f.samples.length, 0),
        })
      }
      handled.add(sg.id)
      for (const fid of sg.family_ids) handled.add(fid)
      continue
    }
    const list = byCategory.get(id)
    if (list && list.length > 0 && !inSupergroup.has(id)) {
      out.push({ kind: 'family', id, label: CATEGORY_LABEL[id] ?? id, samples: list })
      handled.add(id)
    }
  }

  // Anything left over: stable alphabetical, append.
  const leftover = [...byCategory.keys()]
    .filter((c) => !handled.has(c) && !inSupergroup.has(c))
    .sort()
  for (const id of leftover) {
    const list = byCategory.get(id)!
    out.push({ kind: 'family', id, label: CATEGORY_LABEL[id] ?? id, samples: list })
  }

  return out
}

function SectionView({
  section,
  selectedId,
  onSelect,
}: {
  section: Section
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (section.kind === 'family') {
    return (
      <div className="mt-1 first:mt-0">
        <SectionHeader label={section.label} count={section.samples.length} />
        <SampleList samples={section.samples} selectedId={selectedId} onSelect={onSelect} />
      </div>
    )
  }
  // Supergroup: title once at the top, families inline as tighter sub-headers.
  return (
    <div className="mt-1 first:mt-0">
      <SectionHeader label={section.label} count={section.total} />
      {section.families.map((fam, i) => (
        <div key={fam.id} className={i === 0 ? '' : 'mt-1.5'}>
          <SubHeader label={fam.label} count={fam.samples.length} />
          <SampleList samples={fam.samples} selectedId={selectedId} onSelect={onSelect} />
        </div>
      ))}
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-baseline justify-between gap-2 bg-[var(--surface)]/95 px-4 pb-1.5 pt-3 backdrop-blur">
      <span className="text-[11.5px] font-medium tracking-[0.04em] text-[var(--text)]">
        {label}
      </span>
      <span className="numeric font-mono text-[10px] text-[var(--text-subtle)]">{count}</span>
    </div>
  )
}

function SubHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-5 pb-1 pt-1.5">
      <span
        className="font-mono text-[9.5px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.32em' }}
      >
        {label}
      </span>
      <span className="numeric font-mono text-[10px] text-[var(--text-subtle)]">{count}</span>
    </div>
  )
}

function SampleList({
  samples,
  selectedId,
  onSelect,
}: {
  samples: Sample[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ul>
      {samples.map((s) => {
        const active = s.id === selectedId
        return (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.id)}
              title={s.summary}
              className={cn(
                'group relative block w-full px-4 py-1.5 text-left transition-colors',
                active
                  ? 'bg-[var(--elev-1)] text-[var(--text)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--elev-1)]/60 hover:text-[var(--text)]',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full',
                  active ? 'bg-[var(--accent)]' : 'bg-transparent',
                )}
              />
              <span className="block truncate text-[13px] leading-tight">
                {displayTitleFor(s)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Tighter display titles for the sidebar — strips redundant parenthetical
 * qualifiers and category prefixes that the section header already conveys.
 * Falls back to the canonical title.
 */
function displayTitleFor(s: Sample): string {
  const overrides: Record<string, string> = {
    'text.basic': 'Basic',
    'text.streaming': 'Streaming',
    'text.chat': 'Multi-turn chat',
    'text.system-instruction': 'System instruction',
    'text.structured-output': 'Structured output',
    'text.tool-call': 'Function calling',
    'text.tool-call-chat': 'Function calling — chat',
    'text.thinking': 'Thinking',
    'text.context-cache': 'Context cache',
    'text.multimodal-input': 'Multimodal input',
    'text.grounding-search': 'Grounding — Search',
    'text.grounding-maps': 'Grounding — Maps',
    'live.text-roundtrip': 'Text round trip',
    'image.nano-banana': 'Nano Banana',
    'video.veo': 'Veo',
    'music.lyria': 'Lyria',
    'speech.tts-single': 'TTS — single speaker',
    'speech.tts-multi': 'TTS — multi-speaker',
    'embeddings.basic': 'Basic',
  }
  return overrides[s.id] ?? s.title
}
