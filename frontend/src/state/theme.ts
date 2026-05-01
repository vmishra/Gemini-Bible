import { create } from 'zustand'

type Theme = 'dark' | 'light'

type State = {
  theme: Theme
  toggle: () => void
  set: (theme: Theme) => void
}

const STORAGE_KEY = 'gb:theme'

function initial(): Theme {
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function apply(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  localStorage.setItem(STORAGE_KEY, theme)
}

export const useTheme = create<State>((set, get) => {
  const start = initial()
  apply(start)
  return {
    theme: start,
    toggle: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark'
      apply(next)
      set({ theme: next })
    },
    set: (theme) => {
      apply(theme)
      set({ theme })
    },
  }
})
