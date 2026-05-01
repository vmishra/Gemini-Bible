import { create } from 'zustand'
import type { Surface } from './auth'

export type RunMetrics = {
  model: string
  ttft_ms: number | null
  total_ms: number | null
  tokens_per_second: number | null
  input_tokens: number
  cached_tokens: number
  output_tokens: number
  thinking_tokens: number
  tool_use_prompt_tokens: number
  total_tokens: number
  cache_hit_ratio: number
  modalities: { input: Record<string, number>; output: Record<string, number>; cached: Record<string, number> }
  tool_calls: number
  model_calls: number
  finish_reason: string | null
  cost_usd: number
  cost_inr: number
  error: string | null
}

export type GeneratedImage = { mime_type: string; data_b64: string }
export type GeneratedVideo = { mime_type: string; bytes: number; data_b64: string; path?: string }
export type EmbeddingVector = { dimension: number; preview: number[] }

export type RunResult = {
  ok: boolean
  stdout: string
  stderr: string
  parsed:
    | {
        text?: string | null
        model?: string
        finish_reason?: string | null
        usage_metadata?: unknown
        images?: GeneratedImage[]
        video?: GeneratedVideo
        vectors?: EmbeddingVector[]
        snippets?: string[]
        parsed?: unknown
      }
    | null
  exit_code: number
  metrics: RunMetrics | null
}

type State = {
  status: 'idle' | 'running' | 'done' | 'error'
  result: RunResult | null
  error: string | null
  run: (args: {
    sampleId: string
    surface: Surface
    language: 'python' | 'typescript' | 'java'
    model?: string
    prompt?: string
    code_override?: string
  }) => Promise<void>
  reset: () => void
}

export const useRun = create<State>((set) => ({
  status: 'idle',
  result: null,
  error: null,
  reset: () => set({ status: 'idle', result: null, error: null }),
  run: async ({ sampleId, surface, language, model, prompt, code_override }) => {
    set({ status: 'running', error: null })
    try {
      const res = await fetch(`/api/samples/${sampleId}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ surface, language, model, prompt, code_override }),
      })
      if (!res.ok) throw new Error(`run → ${res.status} ${await res.text()}`)
      const result = (await res.json()) as RunResult
      set({ status: 'done', result })
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  },
}))
