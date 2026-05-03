/**
 * /tune — Prompt Tuning page.
 *
 * Single-column scroll layout per spec section 4. Form on top → diff
 * panel as it materialises → optional A/B verdict panel below.
 */

import { useTune } from '../state/tune'
import { TuneForm } from '../components/tune/TuneForm'

export function Tune() {
  const status = useTune((s) => s.status)
  const result = useTune((s) => s.result)
  const error = useTune((s) => s.error)

  return (
    <section className="flex flex-1 flex-col overflow-y-auto bg-[var(--surface)]">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.36em' }}
          >
            prompt tuner · Gemini Bible
          </span>
          <h1 className="text-[28px] font-medium leading-tight text-[var(--text)]">
            Tune a prompt for your target Gemini model.
          </h1>
          <p className="max-w-[60ch] text-[14px] leading-relaxed text-[var(--text-muted)]">
            Surgical edits, one rule at a time. Each diff hunk cites a section of
            the official best-practices guide for the model you picked. Opt into
            an A/B run + judge to see whether each rule actually moved the
            output.
          </p>
        </header>

        <TuneForm />

        {/* Result region — diff + optional A/B verdict land here. */}
        {error ? (
          <div className="rounded-[var(--radius-sm)] border border-red-500/40 bg-red-500/5 px-4 py-3 text-[13px] text-[var(--text)]">
            <span className="font-mono text-[10px] uppercase text-red-400">error</span>
            <p className="mt-1 leading-snug">{error}</p>
          </div>
        ) : null}

        {status === 'done' && result ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-6">
            <p className="font-mono text-[10px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.32em' }}>
              raw result · DiffPanel + ABResultPanel land in the next commits
            </p>
            <pre className="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap font-mono text-[11px] text-[var(--text-muted)]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  )
}
