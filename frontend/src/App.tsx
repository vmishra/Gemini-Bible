export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-10 text-center">
        <span
          className="text-[10.5px] font-medium uppercase text-[var(--text-subtle)] font-mono"
          style={{ letterSpacing: '0.36em' }}
        >
          a runnable reference
        </span>
        <h1
          className="font-display text-[88px] leading-none"
          style={{ fontWeight: 500 }}
        >
          Gemini Bible
        </h1>
        <p className="font-display italic text-[17px] text-[var(--text-muted)]">
          Every API. Every surface. One screen.
        </p>
        <div
          aria-hidden
          className="h-px w-60"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--accent-hairline) 20%, var(--accent-hairline) 80%, transparent)',
          }}
        />
        <span
          className="text-[10.5px] font-medium uppercase text-[var(--text-subtle)] font-mono"
          style={{ letterSpacing: '0.28em' }}
        >
          text · live · image · video · embeddings
        </span>
      </div>
    </main>
  )
}
