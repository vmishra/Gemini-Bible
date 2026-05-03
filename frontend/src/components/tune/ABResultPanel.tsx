/**
 * ABResultPanel — A/B + judge verdict view.
 *
 * Three tabs per spec section 4:
 *   Verdict (default) — overall winner + per-rule attribution
 *   Outputs           — side-by-side original vs tuned model output
 *   Cost              — per-leg breakdown from the cost estimate
 */

import { useState } from 'react'

import type { ABResult, CostEstimate, RuleVerdict } from '../../state/tune'

type Tab = 'verdict' | 'outputs' | 'cost'

const VERDICT_TONE: Record<
  RuleVerdict['verdict'],
  { dot: string; label: string; pillBg: string; pillText: string }
> = {
  helped: {
    dot: 'bg-emerald-400',
    label: 'helped',
    pillBg: 'bg-emerald-500/10 border-emerald-500/30',
    pillText: 'text-emerald-300',
  },
  hurt: {
    dot: 'bg-red-400',
    label: 'hurt',
    pillBg: 'bg-red-500/10 border-red-500/30',
    pillText: 'text-red-300',
  },
  no_change: {
    dot: 'bg-zinc-400',
    label: 'no change',
    pillBg: 'bg-zinc-500/10 border-zinc-500/30',
    pillText: 'text-zinc-300',
  },
  unclear: {
    dot: 'bg-amber-400',
    label: 'unclear',
    pillBg: 'bg-amber-500/10 border-amber-500/30',
    pillText: 'text-amber-300',
  },
}

const WINNER_HEADLINE: Record<ABResult['overall_winner'], string> = {
  tuned: 'Tuned wins',
  original: 'Original wins',
  tie: 'Tie',
}

export function ABResultPanel({
  ab,
  costEstimate,
}: {
  ab: ABResult
  costEstimate: CostEstimate
}) {
  const [tab, setTab] = useState<Tab>('verdict')

  return (
    <section
      className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)]"
      style={{ boxShadow: 'var(--shadow-1)' }}
    >
      <header className="flex items-baseline justify-between border-b border-[var(--border)] px-5 py-3">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          A/B + judge
        </span>
        <Tabs value={tab} onChange={setTab} />
      </header>

      {tab === 'verdict' ? <VerdictTab ab={ab} /> : null}
      {tab === 'outputs' ? <OutputsTab ab={ab} /> : null}
      {tab === 'cost' ? <CostTab estimate={costEstimate} /> : null}
    </section>
  )
}

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const items: { key: Tab; label: string }[] = [
    { key: 'verdict', label: 'Verdict' },
    { key: 'outputs', label: 'Outputs' },
    { key: 'cost', label: 'Cost' },
  ]
  return (
    <div className="flex gap-1">
      {items.map(({ key, label }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors ${
              active
                ? 'border border-[var(--accent-hairline)] bg-[var(--accent-soft)] text-[var(--text)]'
                : 'border border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

function VerdictTab({ ab }: { ab: ABResult }) {
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4">
        <h2 className="text-[20px] font-medium leading-tight text-[var(--text)]">
          {WINNER_HEADLINE[ab.overall_winner]}
        </h2>
        <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          {ab.overall_reasoning}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <span
          className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          per-rule attribution
        </span>
        <ul className="flex flex-col gap-3">
          {ab.per_rule.map((v, i) => (
            <PerRuleRow key={`${v.rule_anchor}-${i}`} verdict={v} />
          ))}
        </ul>
      </div>
    </div>
  )
}

function PerRuleRow({ verdict }: { verdict: RuleVerdict }) {
  const tone = VERDICT_TONE[verdict.verdict] ?? VERDICT_TONE.unclear
  return (
    <li className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]/40 p-4">
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} aria-hidden />
        <code className="font-mono text-[11.5px] text-[var(--text)]">
          {verdict.rule_anchor}
        </code>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase ${tone.pillBg} ${tone.pillText}`}
          style={{ letterSpacing: '0.24em' }}
        >
          {tone.label}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-[var(--text)]">
        {verdict.reasoning}
      </p>

      {(verdict.evidence_quote_original || verdict.evidence_quote_tuned) ? (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {verdict.evidence_quote_original ? (
            <EvidenceBlock label="from original" text={verdict.evidence_quote_original} />
          ) : null}
          {verdict.evidence_quote_tuned ? (
            <EvidenceBlock label="from tuned" text={verdict.evidence_quote_tuned} />
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

function EvidenceBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--elev-1)] p-2">
      <div
        className="mb-1 font-mono text-[9.5px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.32em' }}
      >
        {label}
      </div>
      <blockquote className="font-mono text-[11.5px] italic leading-snug text-[var(--text-muted)]">
        “{text}”
      </blockquote>
    </div>
  )
}

function OutputsTab({ ab }: { ab: ABResult }) {
  return (
    <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
      <OutputBox label="Original" winner={ab.overall_winner === 'original'} text={ab.original_output} />
      <OutputBox label="Tuned" winner={ab.overall_winner === 'tuned'} text={ab.tuned_output} />
    </div>
  )
}

function OutputBox({
  label,
  winner,
  text,
}: {
  label: string
  winner: boolean
  text: string
}) {
  return (
    <div
      className={`flex max-h-[420px] flex-col overflow-hidden rounded-[var(--radius-sm)] border ${
        winner
          ? 'border-[var(--accent-hairline)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] bg-[var(--surface)]/40'
      }`}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--elev-1)]/40 px-3 py-1.5">
        <span
          className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.32em' }}
        >
          {label}
        </span>
        {winner ? (
          <span
            className="font-mono text-[9.5px] uppercase text-[var(--accent)]"
            style={{ letterSpacing: '0.32em' }}
          >
            judge winner
          </span>
        ) : null}
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-[12px] leading-snug text-[var(--text)]">
        {text}
      </pre>
    </div>
  )
}

function CostTab({ estimate }: { estimate: CostEstimate }) {
  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          per-leg breakdown
        </span>
        <span className="font-mono text-[13px] text-[var(--text)]">
          total · {fmtUsd(estimate.total_usd)}
        </span>
      </div>

      <table className="w-full table-fixed text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-subtle)]">
            <th className="py-2 font-mono text-[10px] uppercase" style={{ letterSpacing: '0.28em' }}>
              leg
            </th>
            <th className="py-2 font-mono text-[10px] uppercase" style={{ letterSpacing: '0.28em' }}>
              model
            </th>
            <th className="py-2 text-right font-mono text-[10px] uppercase" style={{ letterSpacing: '0.28em' }}>
              input tokens
            </th>
            <th className="py-2 text-right font-mono text-[10px] uppercase" style={{ letterSpacing: '0.28em' }}>
              output ≤
            </th>
            <th className="py-2 text-right font-mono text-[10px] uppercase" style={{ letterSpacing: '0.28em' }}>
              usd
            </th>
          </tr>
        </thead>
        <tbody>
          {estimate.legs.map((leg) => (
            <tr key={leg.label} className="border-b border-[var(--border)] last:border-b-0">
              <td className="py-2.5 text-[var(--text)]">{leg.label}</td>
              <td className="py-2.5 font-mono text-[11.5px] text-[var(--text-muted)]">{leg.model}</td>
              <td className="py-2.5 text-right font-mono text-[var(--text-muted)]">
                {leg.input_tokens.toLocaleString()}
              </td>
              <td className="py-2.5 text-right font-mono text-[var(--text-muted)]">
                {leg.output_tokens_max.toLocaleString()}
              </td>
              <td className="py-2.5 text-right font-mono text-[var(--text)]">{fmtUsd(leg.usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {estimate.notes.length > 0 ? (
        <ul className="text-[11.5px] text-[var(--text-subtle)]">
          {estimate.notes.map((n, i) => (
            <li key={i}>· {n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function fmtUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}
