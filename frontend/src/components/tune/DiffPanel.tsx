/**
 * DiffPanel — renders the tuner's annotated diff hunks.
 *
 * Per spec: each hunk is collapsed by default (rule title + severity dot
 * + "show change" affordance). Clicking expands to show the before/after
 * spans, the catalog quote, the tuner's rationale paragraph, and an
 * anchor link to the source URL.
 *
 * Top of the panel shows a one-line summary and a Copy tuned prompt
 * button. Empty-hunks state is handled inline with a positive message —
 * "the prompt was already well-formed" is a valid outcome from the tuner.
 */

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Check, ChevronDown, Copy } from 'lucide-react'

import type { DiffHunk, Severity, TuneEndpointResponse } from '../../state/tune'

const SEVERITY_TONE: Record<Severity, { dot: string; label: string }> = {
  blocking: { dot: 'bg-red-400', label: 'blocking' },
  recommended: { dot: 'bg-amber-400', label: 'recommended' },
  informational: { dot: 'bg-sky-400', label: 'informational' },
}

export function DiffPanel({ result }: { result: TuneEndpointResponse }) {
  const summary = useMemo(() => summarise(result.hunks), [result.hunks])

  if (result.hunks.length === 0) {
    return (
      <section className="rounded-[var(--radius-md)] border border-[var(--accent-hairline)] bg-[var(--accent-soft)] p-5">
        <div className="flex flex-col gap-2">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--accent)]"
            style={{ letterSpacing: '0.36em' }}
          >
            tuner verdict
          </span>
          <h2 className="text-[16px] font-medium leading-tight text-[var(--text)]">
            Already well-formed for {hostModelLabel()}.
          </h2>
          <p className="max-w-[60ch] text-[13px] leading-relaxed text-[var(--text-muted)]">
            The tuner found no rules from the applicable catalog that fire on
            this prompt. That's a valid outcome — empty hunks means there's
            nothing to surgically improve at this catalog version.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)]"
      style={{ boxShadow: 'var(--shadow-1)' }}
    >
      <header className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] px-5 py-3">
        <div className="flex flex-col gap-1">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.36em' }}
          >
            tuner diff
          </span>
          <h2 className="text-[15px] font-medium leading-tight text-[var(--text)]">
            {summary}
          </h2>
        </div>
        <CopyButton text={result.tuned} />
      </header>

      <ul className="divide-y divide-[var(--border)]">
        {result.hunks.map((hunk, i) => (
          <HunkRow key={`${hunk.rule_anchor}-${i}`} hunk={hunk} index={i} />
        ))}
      </ul>
    </section>
  )
}

function HunkRow({ hunk, index }: { hunk: DiffHunk; index: number }) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const tone = SEVERITY_TONE[hunk.severity] ?? SEVERITY_TONE.recommended

  return (
    <motion.li
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.32,
        delay: reduced ? 0 : index * 0.05,
        ease: [0.2, 0.7, 0.2, 1],
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-[var(--elev-1)]/60"
      >
        <div className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden />
          <span className="text-[13.5px] font-medium text-[var(--text)]">
            {hunk.rule_title || hunk.rule_anchor}
          </span>
          <code className="font-mono text-[10.5px] text-[var(--text-subtle)]">
            {hunk.rule_anchor}
          </code>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span style={{ letterSpacing: '0.18em' }} className="font-mono uppercase">
            {tone.label}
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.5}
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open ? <HunkBody hunk={hunk} /> : null}
    </motion.li>
  )
}

function HunkBody({ hunk }: { hunk: DiffHunk }) {
  return (
    <div className="border-t border-dashed border-[var(--border)] bg-[var(--surface)]/40 px-5 py-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DiffBlock label="before" tone="del" text={hunk.before} />
        <DiffBlock label="after" tone="add" text={hunk.after} />
      </div>

      <blockquote className="mt-4 border-l-2 border-[var(--accent-hairline)] pl-3 text-[12.5px] italic leading-relaxed text-[var(--text-muted)]">
        {hunk.quote || <em>no catalog quote on file</em>}
      </blockquote>

      <p className="mt-3 text-[13px] leading-relaxed text-[var(--text)]">
        {hunk.rationale}
      </p>

      {hunk.source_url ? (
        <a
          href={hunk.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 font-mono text-[10.5px] uppercase text-[var(--text-subtle)] hover:text-[var(--accent)]"
          style={{ letterSpacing: '0.24em' }}
        >
          <ArrowUpRight size={11} strokeWidth={1.5} />
          source · {shortDomain(hunk.source_url)}
        </a>
      ) : null}
    </div>
  )
}

function DiffBlock({
  label,
  tone,
  text,
}: {
  label: string
  tone: 'add' | 'del'
  text: string | null
}) {
  const colour =
    tone === 'add'
      ? 'border-emerald-500/30 bg-emerald-500/5 text-[var(--text)]'
      : 'border-red-500/30 bg-red-500/5 text-[var(--text-muted)] line-through decoration-red-400/40'
  return (
    <div className={`overflow-x-auto rounded-[var(--radius-sm)] border ${colour} p-2`}>
      <div
        className="mb-1 font-mono text-[9.5px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.32em' }}
      >
        {label}
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-snug">
        {text || ' '}
      </pre>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          // Fallback: silently no-op; clipboard may be blocked in iframes.
        }
      }}
      className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--elev-1)] px-3 py-1.5 text-[11.5px] font-medium text-[var(--text)] hover:border-[var(--accent-hairline)]"
    >
      {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}
      {copied ? 'Copied' : 'Copy tuned prompt'}
    </button>
  )
}

function summarise(hunks: DiffHunk[]): string {
  const ruleSet = new Set(hunks.map((h) => h.rule_anchor))
  const counts: Record<string, number> = { blocking: 0, recommended: 0, informational: 0 }
  for (const h of hunks) counts[h.severity] = (counts[h.severity] ?? 0) + 1
  const parts: string[] = []
  if (counts.blocking) parts.push(`${counts.blocking} blocking`)
  if (counts.recommended) parts.push(`${counts.recommended} recommended`)
  if (counts.informational) parts.push(`${counts.informational} informational`)
  const detail = parts.join(', ')
  return `${hunks.length} change${hunks.length === 1 ? '' : 's'} from ${ruleSet.size} rule${
    ruleSet.size === 1 ? '' : 's'
  }${detail ? ` · ${detail}` : ''}`
}

function shortDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function hostModelLabel(): string {
  // Imported lazily so this component stays decoupled from the store
  // shape — the empty-state header just needs a humanly-readable label.
  // Using window-attached store wouldn't help here; just print "the
  // chosen model" if we don't want to import. Read it inline:
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return 'the chosen model'
}
