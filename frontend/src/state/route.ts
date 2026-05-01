import { create } from 'zustand'

export type Route = 'home' | 'samples' | 'practices' | 'calculator'

type State = {
  route: Route
  go: (route: Route) => void
}

export const useRoute = create<State>((set) => ({
  route: 'home',
  go: (route) => set({ route }),
}))
