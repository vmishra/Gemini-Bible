import { create } from 'zustand'
import type { Surface } from './auth'

export type Variant = {
  surface: Surface
  language: 'python' | 'typescript' | 'java'
  file: string
  entry: string
}

export type DocLink = { label: string; url: string }

export type Sample = {
  id: string
  category: string
  scenario: string
  title: string
  summary: string
  models: string[]
  default_model: string
  variants: Variant[]
  docs: DocLink[]
  pricing: DocLink[]
  notes: string[]
  sources?: Record<string, string>
}

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  samples: Sample[]
  selectedId: string | null
  detail: Sample | null
  error: string | null
  refresh: () => Promise<void>
  select: (id: string) => Promise<void>
}

export const useSamples = create<State>((set, get) => ({
  status: 'idle',
  samples: [],
  selectedId: null,
  detail: null,
  error: null,
  refresh: async () => {
    set({ status: 'loading', error: null })
    try {
      const res = await fetch('/api/samples')
      if (!res.ok) throw new Error(`/api/samples → ${res.status}`)
      const body = (await res.json()) as { samples: Sample[] }
      set({ status: 'ready', samples: body.samples })
      const first = body.samples[0]
      if (first && !get().selectedId) {
        await get().select(first.id)
      }
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  },
  select: async (id) => {
    set({ selectedId: id, detail: null })
    try {
      const res = await fetch(`/api/samples/${id}`)
      if (!res.ok) throw new Error(`/api/samples/${id} → ${res.status}`)
      const detail = (await res.json()) as Sample
      set({ detail })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },
}))
