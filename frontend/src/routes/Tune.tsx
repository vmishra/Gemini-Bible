/**
 * /tune — Prompt Tuning page.
 *
 * Single-column scroll layout per spec section 4. Form on top → diff
 * panel as it materialises → optional A/B verdict panel below. Initial
 * placeholder until TuneForm and the result panels land.
 */

export function Tune() {
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

        <div
          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] p-6 text-[13px] text-[var(--text-muted)]"
          style={{ boxShadow: 'var(--shadow-1)' }}
        >
          Tuner UI lands here in the next commits — TuneForm, DiffPanel,
          ABResultPanel.
        </div>
      </div>
    </section>
  )
}
