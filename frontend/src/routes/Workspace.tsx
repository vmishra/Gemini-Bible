import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useAuth, type Surface } from '../state/auth'
import { useSamples } from '../state/samples'
import { useRun } from '../state/run'
import { Button } from '../ui/components/Button'
import { Chip } from '../ui/components/Chip'
import { Panel } from '../ui/components/Panel'

type Lang = 'python' | 'typescript' | 'java'

export function Workspace() {
  const detail = useSamples((s) => s.detail)
  const auth = useAuth((s) => s.snapshot)

  const [surface, setSurface] = useState<Surface>('ai-studio')
  const [language, setLanguage] = useState<Lang>('python')
  const [model, setModel] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<string>('')

  const variants = detail?.variants ?? []
  const surfaces = useMemo(() => unique(variants.map((v) => v.surface)), [variants])
  const languagesForSurface = useMemo(
    () => unique(variants.filter((v) => v.surface === surface).map((v) => v.language)),
    [variants, surface],
  )

  useEffect(() => {
    if (!detail) return
    if (!surfaces.includes(surface)) setSurface(surfaces[0] ?? 'ai-studio')
    if (!model || !detail.models.includes(model)) setModel(detail.default_model)
  }, [detail, surfaces, surface, model])

  useEffect(() => {
    if (!languagesForSurface.includes(language)) setLanguage(languagesForSurface[0] ?? 'python')
  }, [languagesForSurface, language])

  const variant = variants.find((v) => v.surface === surface && v.language === language)
  const code = variant ? detail?.sources?.[`${variant.surface}:${variant.language}`] ?? '' : ''

  const surfaceAvailable = (s: Surface) =>
    s === 'ai-studio' ? !!auth?.ai_studio.available : !!auth?.vertex.available

  const run = useRun()

  const handleRun = async () => {
    if (!detail || !variant) return
    await run.run({
      sampleId: detail.id,
      surface,
      language,
      model: model ?? undefined,
      prompt: prompt || undefined,
    })
  }

  if (!detail) {
    return (
      <section className="flex flex-1 items-center justify-center">
        <span className="font-display italic text-[17px] text-[var(--text-muted)]">
          select a sample to begin
        </span>
      </section>
    )
  }

  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      <ActivityRibbon model={model} surface={surface} status={run.status} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-6">
          <header className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span
                className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.28em' }}
              >
                {detail.category} · {detail.scenario}
              </span>
            </div>
            <h1 className="text-[28px] font-medium leading-tight tracking-tight">
              {detail.title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
              {detail.summary}
            </p>
          </header>

          <div className="flex flex-wrap items-center gap-2">
            {surfaces.map((s) => (
              <Chip
                key={s}
                tone={s === surface ? 'accent' : 'neutral'}
                interactive
                onClick={() => setSurface(s)}
                title={!surfaceAvailable(s) ? 'no auth detected for this surface' : undefined}
                className={!surfaceAvailable(s) ? 'opacity-60' : ''}
              >
                {s}
              </Chip>
            ))}
            <span className="mx-1 h-4 w-px bg-[var(--border)]" />
            {languagesForSurface.map((l) => (
              <Chip
                key={l}
                tone={l === language ? 'accent' : 'neutral'}
                interactive
                onClick={() => setLanguage(l)}
              >
                {l}
              </Chip>
            ))}
            <span className="mx-1 h-4 w-px bg-[var(--border)]" />
            <select
              className="h-6 rounded-full border border-[var(--border)] bg-[var(--elev-1)] px-2.5 font-mono text-[11px] text-[var(--text)] outline-none"
              value={model ?? ''}
              onChange={(e) => setModel(e.target.value)}
            >
              {detail.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <Panel pad={false} className="overflow-hidden">
            <pre className="overflow-x-auto p-5 font-mono text-[12.5px] leading-[1.65] text-[var(--text)]">
              <code>{code || '—'}</code>
            </pre>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <label className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.28em' }}>
              prompt override
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="leave empty to use the sample's default prompt"
              className="min-h-[80px] w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-raised)] p-3 font-mono text-[13px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)] focus:border-[var(--border-strong)]"
            />
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-[var(--text-subtle)]">
                {variant?.language === 'python'
                  ? 'runs as a python subprocess against your local environment'
                  : 'execution for this language is not yet wired'}
              </span>
              <Button
                variant="primary"
                onClick={handleRun}
                disabled={
                  run.status === 'running' ||
                  variant?.language !== 'python' ||
                  !surfaceAvailable(surface)
                }
              >
                {run.status === 'running' ? 'running…' : 'run'}
              </Button>
            </div>
          </Panel>

          {run.status === 'error' && (
            <Panel className="border-[color-mix(in_oklch,var(--danger)_30%,var(--border))]">
              <div className="text-[13px] text-[var(--danger)]">{run.error}</div>
            </Panel>
          )}

          {run.result && <RunResultPanel />}
        </div>

        <ContextRail />
      </div>
    </section>
  )
}

function ActivityRibbon({ model, surface, status }: { model: string | null; surface: Surface; status: string }) {
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5">
      <Chip tone="trace">{surface}</Chip>
      {model && <Chip tone="trace">{model}</Chip>}
      {status !== 'idle' && (
        <Chip tone={status === 'running' ? 'accent' : status === 'error' ? 'danger' : 'success'}>
          {status}
        </Chip>
      )}
    </div>
  )
}

function RunResultPanel() {
  const result = useRun((s) => s.result)
  if (!result) return null
  const m = result.metrics
  const parsed = result.parsed

  return (
    <div className="flex flex-col gap-3">
      <Panel className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.28em' }}>
            response
          </span>
          {m && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="trace">{m.model}</Chip>
              <Chip tone="neutral">
                <span className="numeric">{m.total_ms?.toFixed(0) ?? '–'}</span>
                <span className="text-[var(--text-subtle)]">ms</span>
              </Chip>
              {m.ttft_ms != null && (
                <Chip tone="neutral">
                  <span className="numeric">{m.ttft_ms.toFixed(0)}</span>
                  <span className="text-[var(--text-subtle)]">ms ttft</span>
                </Chip>
              )}
              {m.tokens_per_second != null && (
                <Chip tone="neutral">
                  <span className="numeric">{m.tokens_per_second}</span>
                  <span className="text-[var(--text-subtle)]">tok/s</span>
                </Chip>
              )}
              {m.finish_reason && <Chip tone="neutral">{m.finish_reason.toLowerCase()}</Chip>}
            </div>
          )}
        </div>

        {parsed?.text && (
          <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--text)]">
            {parsed.text}
          </div>
        )}

        {parsed?.images && parsed.images.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {parsed.images.map((img, i) => (
              <a
                key={i}
                href={`data:${img.mime_type};base64,${img.data_b64}`}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]"
              >
                <img
                  src={`data:${img.mime_type};base64,${img.data_b64}`}
                  alt="generated"
                  className="block h-auto w-full"
                />
              </a>
            ))}
          </div>
        )}

        {parsed?.video && (
          <video
            controls
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)]"
            src={`data:${parsed.video.mime_type};base64,${parsed.video.data_b64}`}
          />
        )}

        {parsed?.vectors && parsed.vectors.length > 0 && (
          <div className="flex flex-col gap-2">
            {parsed.vectors.map((v, i) => (
              <div key={i} className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                {parsed.snippets?.[i] && (
                  <div className="mb-2 text-[12px] text-[var(--text-muted)]">{parsed.snippets[i]}</div>
                )}
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.18em' }}>
                    dim {v.dimension}
                  </span>
                  <code className="numeric truncate font-mono text-[12px] text-[var(--text)]">
                    [{v.preview.map((x) => x.toFixed(4)).join(', ')}, …]
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}

        {!parsed?.text &&
          !parsed?.images?.length &&
          !parsed?.video &&
          !parsed?.vectors?.length && (
            <pre className="overflow-x-auto font-mono text-[12.5px] text-[var(--text-muted)]">
              <code>{result.stdout || result.stderr}</code>
            </pre>
          )}
      </Panel>

      {m && <UsagePanel m={m} />}

      {result.stderr && result.ok && (
        <Panel className="bg-[var(--surface-raised)]">
          <details>
            <summary className="cursor-pointer font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.28em' }}>
              stderr
            </summary>
            <pre className="mt-3 overflow-x-auto font-mono text-[12px] text-[var(--text-muted)]">
              <code>{result.stderr}</code>
            </pre>
          </details>
        </Panel>
      )}
    </div>
  )
}

function UsagePanel({ m }: { m: NonNullable<ReturnType<typeof useRun.getState>['result']>['metrics'] }) {
  if (!m) return null
  const rows: Array<[string, string | number, string?]> = [
    ['input', m.input_tokens, 'tok'],
    ['cached', m.cached_tokens, 'tok'],
    ['output', m.output_tokens, 'tok'],
    ['thinking', m.thinking_tokens, 'tok'],
    ['total', m.total_tokens, 'tok'],
    ['cache hit', `${(m.cache_hit_ratio * 100).toFixed(1)}`, '%'],
    ['cost', `$${m.cost_usd.toFixed(6)}`],
    ['cost', `₹${m.cost_inr.toFixed(4)}`],
  ]
  return (
    <Panel pad={false} className="overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-3">
        <span className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.28em' }}>
          usage
        </span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-[var(--border)]">
        {rows.map(([label, value, unit], i) => (
          <div
            key={`${label}-${i}`}
            className="flex flex-col gap-1 px-5 py-3"
            style={{ borderTop: i >= 4 ? '1px solid var(--border)' : undefined }}
          >
            <span className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.18em' }}>
              {label}
            </span>
            <span className="numeric font-mono text-[16px] text-[var(--text)]">
              {value}
              {unit && <span className="ml-1 text-[12px] text-[var(--text-subtle)]">{unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function ContextRail() {
  const detail = useSamples((s) => s.detail)
  if (!detail) return null
  return (
    <aside className="hidden w-[320px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] px-6 py-6 lg:flex">
      <RailSection label="documentation">
        {detail.docs.map((d) => (
          <RailLink key={d.url} {...d} />
        ))}
      </RailSection>
      <RailSection label="pricing">
        {detail.pricing.map((d) => (
          <RailLink key={d.url} {...d} />
        ))}
      </RailSection>
      {detail.notes.length > 0 && (
        <RailSection label="notes">
          <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
            {detail.notes.map((n) => (
              <li key={n} className="border-l border-[var(--accent-hairline)] pl-3">
                {n}
              </li>
            ))}
          </ul>
        </RailSection>
      )}
    </aside>
  )
}

function RailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <span className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.28em' }}>
        {label}
      </span>
      {children}
    </section>
  )
}

function RailLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2 -mx-3 hover:bg-[var(--elev-1)] transition-colors"
    >
      <span className="text-[13px] leading-snug text-[var(--text)]">{label}</span>
      <ExternalLink size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[var(--text-subtle)] group-hover:text-[var(--text-muted)]" />
    </a>
  )
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}
