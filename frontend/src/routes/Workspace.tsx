import { useEffect, useMemo, useState } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { Check, Copy, ExternalLink, RotateCcw } from 'lucide-react'
import { useAuth, type Surface } from '../state/auth'
import { useSamples } from '../state/samples'
import { useRun, renderSourceForModel } from '../state/run'
import { useTheme } from '../state/theme'
import { usePricing, rateFor } from '../state/pricing'
import { useMetrics, summarizeFor } from '../state/metricsStore'
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
  const originalCode = variant ? detail?.sources?.[`${variant.surface}:${variant.language}`] ?? '' : ''

  // The "rendered" baseline: original source with the chosen model literal
  // swapped in. The user can edit further; edits override the baseline.
  const renderedCode = useMemo(
    () =>
      detail && model
        ? renderSourceForModel(originalCode, detail.default_model, model)
        : originalCode,
    [detail, model, originalCode],
  )

  const [editedCode, setEditedCode] = useState<string | null>(null)
  // Reset edits whenever the underlying baseline changes (sample/surface/language/model).
  useEffect(() => {
    setEditedCode(null)
  }, [detail?.id, surface, language, model])

  const code = editedCode ?? renderedCode
  const isEdited = editedCode !== null && editedCode !== renderedCode

  const surfaceAvailable = (s: Surface) =>
    s === 'ai-studio' ? !!auth?.ai_studio.available : !!auth?.vertex.available

  const run = useRun()

  const refreshMetrics = useMetrics((s) => s.refresh)
  useEffect(() => {
    void refreshMetrics()
  }, [refreshMetrics])

  const handleRun = async () => {
    if (!detail || !variant) return
    await run.run({
      sampleId: detail.id,
      surface,
      language,
      model: model ?? undefined,
      prompt: prompt || undefined,
      code_override: isEdited ? code : undefined,
    })
    void refreshMetrics()
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

          {model && detail && (
            <ModelCard sampleId={detail.id} model={model} surface={surface} />
          )}

          <CodePanel
            code={code}
            path={variant?.file ?? null}
            language={language}
            edited={isEdited}
            onChange={(next) => setEditedCode(next)}
            onReset={() => setEditedCode(null)}
          />


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

function ModelCard({
  sampleId,
  model,
  surface,
}: {
  sampleId: string
  model: string
  surface: Surface
}) {
  const pricing = usePricing((s) => s.data)
  const refreshPricing = usePricing((s) => s.refresh)
  const pricingStatus = usePricing((s) => s.status)
  const metrics = useMetrics((s) => s.data)

  useEffect(() => {
    if (pricingStatus === 'idle') void refreshPricing()
  }, [pricingStatus, refreshPricing])

  const rate = rateFor(pricing, model)
  const live = summarizeFor(metrics, (r) => r.sample_id === sampleId && r.model === model)

  return (
    <Panel pad={false} className="overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[var(--border)]">
        <section className="flex flex-col gap-3 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span
                className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.28em' }}
              >
                model
              </span>
              <span className="font-mono text-[14px] text-[var(--text)]">{model}</span>
            </div>
            <span
              className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
              style={{ letterSpacing: '0.28em' }}
            >
              {surface}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <PriceCell label="input" value={rate?.input_per_mtok_usd} />
            <PriceCell label="output" value={rate?.output_per_mtok_usd} />
            <PriceCell label="cached input" value={rate?.cached_input_per_mtok_usd} />
          </div>
          {rate?.asset_note && (
            <span className="text-[12px] text-[var(--text-muted)]">{rate.asset_note}</span>
          )}
          {!rate && pricingStatus === 'ready' && (
            <span className="text-[12px] text-[var(--text-subtle)]">
              no entry for {model} — add it to backend/app/metrics.py or verify ai.google.dev/pricing
            </span>
          )}
          {!rate && pricingStatus === 'loading' && (
            <span className="text-[12px] text-[var(--text-subtle)]">loading rate card…</span>
          )}
          {!rate && pricingStatus === 'error' && (
            <span className="text-[12px] text-[var(--danger)]">
              pricing service unreachable — restart the backend with ./app.sh restart
            </span>
          )}
        </section>
        <section className="flex flex-col gap-3 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span
              className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
              style={{ letterSpacing: '0.28em' }}
            >
              recent runs · this sample · this model
            </span>
            <span className="numeric font-mono text-[10.5px] text-[var(--text-subtle)]">
              n = {live.count}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <MetricCell label="latency p50" value={live.latency_p50_ms} unit="ms" />
            <MetricCell label="ttft p50" value={live.ttft_p50_ms} unit="ms" />
            <MetricCell label="tokens" value={live.total_tokens} />
            <MetricCell label="cost" value={live.total_cost_usd} prefix="$" precision={6} />
          </div>
        </section>
      </div>
    </Panel>
  )
}

function PriceCell({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.18em' }}
      >
        {label}
      </span>
      <span className="numeric font-mono text-[14px] text-[var(--text)]">
        {value != null ? `$${value.toFixed(2)}` : '–'}
        <span className="ml-1 text-[10.5px] text-[var(--text-subtle)]">/ MTok</span>
      </span>
    </div>
  )
}

function MetricCell({
  label,
  value,
  unit,
  prefix,
  precision = 0,
}: {
  label: string
  value: number | null
  unit?: string
  prefix?: string
  precision?: number
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.18em' }}
      >
        {label}
      </span>
      <span className="numeric font-mono text-[14px] text-[var(--text)]">
        {value == null ? (
          '–'
        ) : (
          <>
            {prefix}
            {precision > 0 ? value.toFixed(precision) : value.toLocaleString()}
            {unit && <span className="ml-1 text-[10.5px] text-[var(--text-subtle)]">{unit}</span>}
          </>
        )}
      </span>
    </div>
  )
}

// Monaco doesn't read CSS variables; define matching themes once so the editor
// surface tracks the surrounding panel instead of falling into a vs-dark pit.
let monacoThemesDefined = false
function defineMonacoThemes(monaco: Monaco) {
  if (monacoThemesDefined) return
  monacoThemesDefined = true

  monaco.editor.defineTheme('gemini-bible-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'F5F5F5' },
      { token: 'comment', foreground: '8A8294', fontStyle: 'italic' },
      { token: 'string', foreground: 'D4C58E' },
      { token: 'string.escape', foreground: 'D4C58E' },
      { token: 'number', foreground: 'D4C58E' },
      { token: 'keyword', foreground: 'C7B6E0' },
      { token: 'keyword.flow', foreground: 'C7B6E0' },
      { token: 'type', foreground: '9DC3D8' },
      { token: 'type.identifier', foreground: '9DC3D8' },
      { token: 'identifier', foreground: 'EAEAEA' },
      { token: 'delimiter', foreground: 'A8A5B0' },
      { token: 'tag', foreground: 'C7B6E0' },
    ],
    colors: {
      'editor.background': '#26252B',
      'editor.foreground': '#F5F5F5',
      'editorLineNumber.foreground': '#5C5867',
      'editorLineNumber.activeForeground': '#A8A5B0',
      'editor.selectionBackground': '#D2B477AA',
      'editor.inactiveSelectionBackground': '#D2B47755',
      'editor.lineHighlightBackground': '#00000000',
      'editorCursor.foreground': '#D2B477',
      'editorIndentGuide.background1': '#3A3744',
      'editorIndentGuide.activeBackground1': '#5C5867',
      'editorWidget.background': '#2D2A33',
      'editorWidget.border': '#4A4654',
      'scrollbarSlider.background': '#5C586733',
      'scrollbarSlider.hoverBackground': '#5C586766',
      'scrollbarSlider.activeBackground': '#5C586799',
    },
  })

  monaco.editor.defineTheme('gemini-bible-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: '', foreground: '1F1D26' },
      { token: 'comment', foreground: '8A8294', fontStyle: 'italic' },
      { token: 'string', foreground: '7A5A18' },
      { token: 'number', foreground: '7A5A18' },
      { token: 'keyword', foreground: '5E4290' },
      { token: 'type', foreground: '2F6280' },
    ],
    colors: {
      'editor.background': '#F4F2EE',
      'editor.foreground': '#1F1D26',
      'editorLineNumber.foreground': '#A8A5B0',
      'editorLineNumber.activeForeground': '#52505A',
      'editor.selectionBackground': '#C29A4744',
      'editor.lineHighlightBackground': '#00000000',
      'editorCursor.foreground': '#9C7325',
    },
  })
}

type CodePanelProps = {
  code: string
  path: string | null
  language: Lang
  edited: boolean
  onChange: (next: string) => void
  onReset: () => void
}

const monacoLangByLanguage: Record<Lang, string> = {
  python: 'python',
  typescript: 'typescript',
  java: 'java',
}

function CodePanel({ code, path, language, edited, onChange, onReset }: CodePanelProps) {
  const [copied, setCopied] = useState(false)
  const theme = useTheme((s) => s.theme)
  const lineCount = useMemo(() => (code ? code.split('\n').length : 0), [code])

  const handleCopy = async () => {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard not available — silent */
    }
  }

  return (
    <Panel pad={false} className="flex flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div className="flex items-center gap-3">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.28em' }}
          >
            {language}
          </span>
          {path && (
            <span className="font-mono text-[11px] text-[var(--text-muted)]">{path}</span>
          )}
          {edited && (
            <span
              className="font-mono text-[10px] uppercase text-[var(--accent)]"
              style={{ letterSpacing: '0.2em' }}
            >
              edited
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="numeric font-mono text-[10.5px] text-[var(--text-subtle)]">
            {lineCount} lines
          </span>
          {edited && (
            <button
              type="button"
              aria-label="reset to original"
              onClick={onReset}
              className="flex h-6 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[11px] text-[var(--text-muted)] hover:bg-[var(--elev-2)] hover:text-[var(--text)] transition-colors"
            >
              <RotateCcw size={12} strokeWidth={1.5} />
              reset
            </button>
          )}
          <button
            type="button"
            aria-label="copy code"
            onClick={handleCopy}
            className="flex h-6 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-[11px] text-[var(--text-muted)] hover:bg-[var(--elev-2)] hover:text-[var(--text)] transition-colors"
          >
            {copied ? <Check size={12} strokeWidth={1.5} /> : <Copy size={12} strokeWidth={1.5} />}
            {copied ? 'copied' : 'copy'}
          </button>
        </div>
      </div>
      <div style={{ height: 'min(60vh, 560px)' }}>
        <Editor
          value={code}
          language={monacoLangByLanguage[language]}
          onChange={(v) => onChange(v ?? '')}
          beforeMount={defineMonacoThemes}
          theme={theme === 'dark' ? 'gemini-bible-dark' : 'gemini-bible-light'}
          options={{
            fontSize: 12.5,
            fontFamily: '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, monospace',
            fontLigatures: true,
            lineNumbers: 'on',
            renderLineHighlight: 'none',
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            padding: { top: 12, bottom: 12 },
            tabSize: 4,
            automaticLayout: true,
            wordWrap: 'on',
            overviewRulerLanes: 0,
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
      </div>
    </Panel>
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

        {parsed?.audio && (
          <audio
            controls
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)]"
            src={`data:${parsed.audio.mime_type};base64,${parsed.audio.data_b64}`}
          />
        )}

        {parsed?.audio_clips && parsed.audio_clips.length > 1 && (
          <div className="flex flex-col gap-2">
            {parsed.audio_clips.slice(1).map((clip, i) => (
              <audio
                key={i}
                controls
                className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)]"
                src={`data:${clip.mime_type};base64,${clip.data_b64}`}
              />
            ))}
          </div>
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
          !parsed?.audio &&
          !parsed?.audio_clips?.length &&
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
