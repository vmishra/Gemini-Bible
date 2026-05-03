/**
 * TuneForm — the input surface of the /tune page.
 *
 * Composes:
 *   prompt textarea (auto-grow),
 *   target-model select,
 *   A/B-judge toggle,
 *   debounced cost preview,
 *   Tune button (with cost echo).
 */

import { useEffect, useRef } from 'react'

import { useTune } from '../../state/tune'

// Text-capable Gemini models the tuner is built for. (Image / video / TTS /
// embeddings models are deliberately excluded — the tuner has no rules
// for those modalities.)
const TEXT_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
] as const

const ESTIMATE_DEBOUNCE_MS = 400

export function TuneForm() {
  const prompt = useTune((s) => s.prompt)
  const targetModel = useTune((s) => s.targetModel)
  const runAB = useTune((s) => s.runAB)
  const setPrompt = useTune((s) => s.setPrompt)
  const setTargetModel = useTune((s) => s.setTargetModel)
  const setRunAB = useTune((s) => s.setRunAB)

  const status = useTune((s) => s.status)
  const submit = useTune((s) => s.submit)

  const estimate = useTune((s) => s.estimate)
  const fetchEstimate = useTune((s) => s.fetchEstimate)

  // Debounced estimate fetch on (prompt, targetModel, runAB) changes.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void fetchEstimate()
    }, ESTIMATE_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [prompt, targetModel, runAB, fetchEstimate])

  const inFlight = status === 'tuning'
  const buttonLabel = inFlight ? 'Tuning…' : `Tune on ${targetModel}`
  const tuneOnly = estimate?.legs.find((l) => l.label === 'tuner')?.usd ?? null
  const totalCost = estimate?.total_usd ?? null

  return (
    <section className="flex flex-col gap-4">
      {/* Header row: model picker + AB toggle aligned right */}
      <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-3">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          input prompt
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
            <span>Target model</span>
            <select
              className="h-6 rounded-full border border-[var(--border)] bg-[var(--elev-1)] px-2.5 font-mono text-[11px] text-[var(--text)] outline-none"
              value={targetModel}
              onChange={(e) => setTargetModel(e.target.value)}
              disabled={inFlight}
            >
              {TEXT_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Prompt textarea */}
      <textarea
        className="min-h-[200px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--elev-1)] p-4 font-mono text-[13px] leading-snug text-[var(--text)] outline-none focus:border-[var(--accent-hairline)]"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={
          'Paste your prompt here — the tuner will return a surgical diff with rule citations.\n\nTry: "Please carefully explain transformers in three sentences."'
        }
        spellCheck={false}
        disabled={inFlight}
      />

      {/* Footer row: A/B toggle (left) + cost preview + Tune button (right) */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--text)]">
          <input
            type="checkbox"
            checked={runAB}
            onChange={(e) => setRunAB(e.target.checked)}
            disabled={inFlight}
            className="h-3.5 w-3.5 rounded border-[var(--border)] bg-[var(--elev-1)]"
          />
          <span>Run A/B comparison + judge</span>
          <span className="text-[11.5px] text-[var(--text-subtle)]">
            (fires both prompts on the target, then a Pro judge scores per rule)
          </span>
        </label>

        <div className="flex items-end gap-4">
          <CostPreview
            tuneOnlyUsd={tuneOnly}
            totalUsd={totalCost}
            runAB={runAB}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={inFlight || !prompt.trim()}
            className="rounded-full border border-[var(--accent-hairline)] bg-[var(--accent-soft)] px-4 py-2 text-[12.5px] font-medium text-[var(--text)] hover:bg-[var(--accent-soft-hover,var(--accent-soft))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </section>
  )
}

/**
 * Two-line cost readout. Top line: "Tune only — $X.XX" (always shown if we
 * have an estimate). Second line: "+ A/B + judge — $Y.YY" (only when toggle
 * is on). Currency formatted at 4 decimal places to make sub-cent estimates
 * legible.
 */
function CostPreview({
  tuneOnlyUsd,
  totalUsd,
  runAB,
}: {
  tuneOnlyUsd: number | null
  totalUsd: number | null
  runAB: boolean
}) {
  if (tuneOnlyUsd == null || totalUsd == null) {
    return (
      <div className="flex flex-col items-end font-mono text-[10.5px] text-[var(--text-subtle)]">
        <span>—</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-end gap-0.5 font-mono text-[10.5px] text-[var(--text-muted)]">
      <span>Tune only · {fmtUsd(tuneOnlyUsd)}</span>
      {runAB ? (
        <span className="text-[var(--text)]">+ A/B + judge · {fmtUsd(totalUsd)}</span>
      ) : null}
    </div>
  )
}

function fmtUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}
