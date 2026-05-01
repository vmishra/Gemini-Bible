import { create } from 'zustand'
import type { RunMetrics } from './run'

export type MetricsSummary = {
  count: number
  ttft_p50_ms: number | null
  ttft_p95_ms: number | null
  latency_p50_ms: number | null
  latency_p95_ms: number | null
  tokens_per_second_p50: number | null
  total_input_tokens: number
  total_cached_tokens: number
  total_output_tokens: number
  total_thinking_tokens: number
  total_tokens: number
  cache_hit_ratio: number
  total_tool_calls: number
  total_model_calls: number
  total_cost_usd: number
  total_cost_inr: number
  error_count: number
}

export type MetricsRun = RunMetrics & { sample_id?: string; surface?: string }

export type MetricsSnapshot = {
  summary: MetricsSummary | { count: 0 }
  runs: MetricsRun[]
}

type State = {
  data: MetricsSnapshot | null
  refresh: () => Promise<void>
  reset: () => Promise<void>
}

export const useMetrics = create<State>((set) => ({
  data: null,
  refresh: async () => {
    try {
      const res = await fetch('/api/metrics')
      if (res.ok) set({ data: (await res.json()) as MetricsSnapshot })
    } catch {
      /* swallow — best effort */
    }
  },
  reset: async () => {
    await fetch('/api/metrics/reset', { method: 'POST' })
    set({ data: { summary: { count: 0 }, runs: [] } })
  },
}))

export function summarizeFor(
  snapshot: MetricsSnapshot | null,
  predicate: (run: MetricsRun) => boolean,
): {
  count: number
  latency_p50_ms: number | null
  ttft_p50_ms: number | null
  total_tokens: number
  total_cost_usd: number
  total_cost_inr: number
} {
  if (!snapshot) return zero()
  const matched = snapshot.runs.filter(predicate)
  if (matched.length === 0) return zero()
  const lat = matched.map((r) => r.total_ms).filter((v): v is number => v != null)
  const ttft = matched.map((r) => r.ttft_ms).filter((v): v is number => v != null)
  return {
    count: matched.length,
    latency_p50_ms: lat.length ? round1(median(lat)) : null,
    ttft_p50_ms: ttft.length ? round1(median(ttft)) : null,
    total_tokens: matched.reduce((s, r) => s + (r.total_tokens || 0), 0),
    total_cost_usd: round6(matched.reduce((s, r) => s + (r.cost_usd || 0), 0)),
    total_cost_inr: round4(matched.reduce((s, r) => s + (r.cost_inr || 0), 0)),
  }
}

function zero() {
  return { count: 0, latency_p50_ms: null, ttft_p50_ms: null, total_tokens: 0, total_cost_usd: 0, total_cost_inr: 0 }
}
function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const m = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2
}
function round1(n: number) { return Math.round(n * 10) / 10 }
function round4(n: number) { return Math.round(n * 10000) / 10000 }
function round6(n: number) { return Math.round(n * 1000000) / 1000000 }
