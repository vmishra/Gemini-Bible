import { useEffect } from 'react'
import { useAuth } from './state/auth'
import { useSamples } from './state/samples'
import { Topbar } from './ui/layout/Topbar'
import { Browser } from './routes/Browser'
import { Workspace } from './routes/Workspace'

export function App() {
  const refreshAuth = useAuth((s) => s.refresh)
  const refreshSamples = useSamples((s) => s.refresh)

  useEffect(() => {
    void refreshAuth()
    void refreshSamples()
  }, [refreshAuth, refreshSamples])

  return (
    <div className="flex h-screen flex-col bg-[var(--surface)] text-[var(--text)]">
      <Topbar />
      <main className="flex flex-1 overflow-hidden">
        <Browser />
        <Workspace />
      </main>
    </div>
  )
}
