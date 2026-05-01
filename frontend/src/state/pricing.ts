import { create } from 'zustand'

export type ModelRate = {
  input_per_mtok_usd: number
  output_per_mtok_usd: number
  cached_input_per_mtok_usd: number | null
  audio_input_per_mtok_usd?: number | null
  cached_audio_per_mtok_usd?: number | null
  image_input_per_mtok_usd?: number | null
  video_input_per_mtok_usd?: number | null
  long_context_threshold_tokens?: number | null
  long_context_input_per_mtok_usd?: number | null
  long_context_output_per_mtok_usd?: number | null
  long_context_cached_per_mtok_usd?: number | null
  storage_per_mtok_per_hour_usd?: number | null
  asset_note?: string | null
  notes?: string | null
}

export type PricingMeta = {
  as_of: string
  source_url: string
}

export type PricingSnapshot = {
  rate_card: Record<string, ModelRate>
  usd_to_inr: number
  as_of?: string
  source_url?: string
}

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: PricingSnapshot | null
  error: string | null
  refresh: () => Promise<void>
}

export const usePricing = create<State>((set) => ({
  status: 'idle',
  data: null,
  error: null,
  refresh: async () => {
    set({ status: 'loading', error: null })
    try {
      const res = await fetch('/api/pricing')
      if (!res.ok) throw new Error(`/api/pricing → ${res.status}`)
      const data = (await res.json()) as PricingSnapshot
      set({ status: 'ready', data })
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  },
}))

// Longest-prefix model match (mirror of metrics._price_of in Python).
export function rateFor(snapshot: PricingSnapshot | null, model: string | null): ModelRate | null {
  if (!snapshot || !model) return null
  let best = ''
  for (const id of Object.keys(snapshot.rate_card)) {
    if (model.startsWith(id) && id.length > best.length) best = id
  }
  return best ? snapshot.rate_card[best] : null
}
