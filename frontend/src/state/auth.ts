import { create } from 'zustand'

export type Surface = 'ai-studio' | 'vertex'

export type AuthSnapshot = {
  ai_studio: { available: boolean; source: string | null }
  vertex: {
    available: boolean
    adc_source: string | null
    project: string | null
    location: string | null
  }
  surfaces: Surface[]
}

type State = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  snapshot: AuthSnapshot | null
  error: string | null
  refresh: () => Promise<void>
}

export const useAuth = create<State>((set) => ({
  status: 'idle',
  snapshot: null,
  error: null,
  refresh: async () => {
    set({ status: 'loading', error: null })
    try {
      const res = await fetch('/api/auth')
      if (!res.ok) throw new Error(`/api/auth → ${res.status}`)
      const snapshot = (await res.json()) as AuthSnapshot
      set({ status: 'ready', snapshot })
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  },
}))
