/**
 * Prompt-Tuner state — form, last result, session-cumulative spend.
 *
 * Wire types mirror backend/app/tune.py exactly. Keep the two in sync;
 * the type names are intentionally identical so a code search lands in
 * both files.
 */

import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────
// Wire types — must mirror backend/app/tune.py
// ─────────────────────────────────────────────────────────────────────

export type HunkOp = 'replace' | 'insert' | 'delete'

export type DiffHunk = {
  op: HunkOp
  before: string | null
  after: string | null
  rule_anchor: string
  rationale: string
  quote: string
}

export type CostLeg = {
  label: string
  model: string
  input_tokens: number
  output_tokens_max: number
  usd: number
}

export type CostEstimate = {
  legs: CostLeg[]
  total_usd: number
  run_ab: boolean
  notes: string[]
}

export type RuleVerdict = {
  rule_anchor: string
  verdict: 'helped' | 'hurt' | 'no_change' | 'unclear'
  reasoning: string
  evidence_quote_original: string | null
  evidence_quote_tuned: string | null
}

export type ABResult = {
  original_output: string
  tuned_output: string
  overall_winner: 'original' | 'tuned' | 'tie'
  overall_reasoning: string
  per_rule: RuleVerdict[]
}

export type TuneEndpointResponse = {
  original: string
  tuned: string
  hunks: DiffHunk[]
  rules_considered: string[]
  cost_estimate: CostEstimate
  ab: ABResult | null
}

// ─────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────

export type TuneStatus = 'idle' | 'estimating' | 'tuning' | 'done' | 'error'

type TuneSpendEntry = {
  timestamp: number
  usd: number
  model: string
  ran_ab: boolean
}

type State = {
  // Form
  prompt: string
  targetModel: string
  runAB: boolean
  setPrompt: (p: string) => void
  setTargetModel: (m: string) => void
  setRunAB: (v: boolean) => void

  // Pre-flight estimate (independent of submit)
  estimate: CostEstimate | null
  estimateError: string | null
  fetchEstimate: () => Promise<void>

  // Tune submission
  status: TuneStatus
  result: TuneEndpointResponse | null
  error: string | null
  submit: () => Promise<void>
  reset: () => void

  // Session telemetry — cumulative spend across all tunes since page load
  sessionSpendUsd: number
  spendHistory: TuneSpendEntry[]
}

const DEFAULT_TARGET = 'gemini-3-flash-preview'

export const useTune = create<State>((set, get) => ({
  prompt: '',
  targetModel: DEFAULT_TARGET,
  runAB: false,
  setPrompt: (prompt) => set({ prompt }),
  setTargetModel: (targetModel) => set({ targetModel }),
  setRunAB: (runAB) => set({ runAB }),

  estimate: null,
  estimateError: null,
  fetchEstimate: async () => {
    const { prompt, targetModel, runAB } = get()
    if (!prompt.trim()) {
      set({ estimate: null, estimateError: null })
      return
    }
    try {
      const res = await fetch('/api/tune/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          target_model: targetModel,
          run_ab: runAB,
        }),
      })
      if (!res.ok) throw new Error(`/api/tune/estimate → ${res.status}`)
      const data = (await res.json()) as CostEstimate
      set({ estimate: data, estimateError: null })
    } catch (err) {
      set({
        estimate: null,
        estimateError: err instanceof Error ? err.message : String(err),
      })
    }
  },

  status: 'idle',
  result: null,
  error: null,
  submit: async () => {
    const { prompt, targetModel, runAB } = get()
    if (!prompt.trim()) return
    set({ status: 'tuning', error: null })
    try {
      const res = await fetch('/api/tune', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          target_model: targetModel,
          run_ab: runAB,
        }),
      })
      if (!res.ok) {
        const detail = await safeJson(res)
        const message =
          typeof detail === 'string'
            ? detail
            : extractDetail(detail) ?? `/api/tune → ${res.status}`
        throw new Error(message)
      }
      const data = (await res.json()) as TuneEndpointResponse
      set((s) => ({
        status: 'done',
        result: data,
        sessionSpendUsd: s.sessionSpendUsd + data.cost_estimate.total_usd,
        spendHistory: [
          ...s.spendHistory.slice(-9),
          {
            timestamp: Date.now(),
            usd: data.cost_estimate.total_usd,
            model: targetModel,
            ran_ab: runAB,
          },
        ],
      }))
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  },
  reset: () => set({ status: 'idle', result: null, error: null }),

  sessionSpendUsd: 0,
  spendHistory: [],
}))

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function extractDetail(body: unknown): string | null {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail
    if (typeof d === 'string') return d
    if (d && typeof d === 'object' && 'error' in d) {
      const e = (d as { error: unknown }).error
      return typeof e === 'string' ? e : null
    }
  }
  return null
}
