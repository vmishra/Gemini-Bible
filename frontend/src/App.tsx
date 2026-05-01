import { useEffect } from 'react'
import { useAuth } from './state/auth'
import { useSamples } from './state/samples'
import { useRoute } from './state/route'
import { usePricing } from './state/pricing'
import { Topbar } from './ui/layout/Topbar'
import { Browser } from './routes/Browser'
import { Workspace } from './routes/Workspace'
import { Home } from './routes/Home'
import { Practices } from './routes/Practices'

export function App() {
  const refreshAuth = useAuth((s) => s.refresh)
  const refreshSamples = useSamples((s) => s.refresh)
  const refreshPricing = usePricing((s) => s.refresh)
  const route = useRoute((s) => s.route)

  return (
    <div className="flex h-screen flex-col bg-[var(--surface)] text-[var(--text)]">
      <Topbar />
      <main className="flex flex-1 overflow-hidden">
        {route === 'home' && <HomeRouteShell refresh={[refreshAuth, refreshSamples, refreshPricing]} />}
        {route === 'practices' && <PracticesRouteShell />}
        {route === 'samples' && <SamplesRouteShell refresh={[refreshAuth, refreshSamples, refreshPricing]} />}
      </main>
    </div>
  )
}

function HomeRouteShell({ refresh }: { refresh: Array<() => Promise<void>> }) {
  useEffect(() => {
    refresh.forEach((fn) => void fn())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return <Home />
}

function PracticesRouteShell() {
  return <Practices />
}

function SamplesRouteShell({ refresh }: { refresh: Array<() => Promise<void>> }) {
  useEffect(() => {
    refresh.forEach((fn) => void fn())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <>
      <Browser />
      <Workspace />
    </>
  )
}
