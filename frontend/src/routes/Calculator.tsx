import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Calculator as CalcIcon, AlertTriangle } from 'lucide-react'
import { rateFor, usePricing } from '../state/pricing'
import {
  buildComparisons,
  computeCost,
  familyFor,
  IMAGE_PER_ASSET_USD,
  LYRIA_PER_SONG_USD,
  throughputToOutputTokens,
  VEO_PER_SECOND_USD,
  type CalcInputs,
  type CalcResult,
  type ImageGenInputs,
  type LiveInputs,
  type ModelFamily,
  type MusicGenInputs,
  type TextInputs,
  type TTSInputs,
  type VideoGenInputs,
  type EmbeddingsInputs,
} from '../state/calculator'
import { Panel } from '../ui/components/Panel'
import { cn } from '../ui/cn'

const USD_TO_INR = 84.0

/**
 * Calculator — pick a model, fill in only the inputs that matter for that
 * model, see a deterministic cost breakdown plus comparisons.
 *
 * Design points:
 *   - Rate comes from /api/pricing (no fabrication).
 *   - Form fields adapt to the model family (text vs image-gen vs video-gen
 *     vs music vs embeddings vs Live vs TTS).
 *   - For text models, a throughput helper converts "tokens/sec for N minutes"
 *     into an output-tokens count — answering the user's specific scenario.
 *   - Discount panel shows Batch (-50%), Cache off, Priority Inference (×3.6)
 *     side by side with the baseline.
 */

export function Calculator() {
  const pricing = usePricing((s) => s.data)
  const refreshPricing = usePricing((s) => s.refresh)

  useEffect(() => {
    if (!pricing) void refreshPricing()
  }, [pricing, refreshPricing])

  const tokenBilled = useMemo(() => {
    if (!pricing) return [] as { id: string; family: ModelFamily }[]
    return Object.keys(pricing.rate_card)
      .map((id) => ({ id, family: familyFor(id) }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [pricing])

  const [modelId, setModelId] = useState<string>('gemini-3-flash-preview')

  // Default to a sensible model when the rate-card loads.
  useEffect(() => {
    if (pricing && !pricing.rate_card[modelId]) {
      setModelId('gemini-3-flash-preview' in pricing.rate_card ? 'gemini-3-flash-preview' : Object.keys(pricing.rate_card)[0])
    }
  }, [pricing, modelId])

  const family = familyFor(modelId)

  return (
    <section className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-[var(--border)] px-10 py-10">
        <div className="flex items-center gap-3">
          <CalcIcon size={20} strokeWidth={1.5} className="text-[var(--accent)]" />
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.36em' }}
          >
            calculator
          </span>
        </div>
        <h1 className="mt-3 font-display text-[44px] leading-[1.05]" style={{ fontWeight: 500 }}>
          What it actually costs.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
          Pick a model, fill in only the inputs that matter for it, see a
          deterministic per-call breakdown plus a period-scaled total. The
          throughput helper handles workload questions like
          <em> "1,000 tokens/sec output for 60 minutes — what does it cost?"</em>
        </p>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-8 px-10 py-10 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-6">
          <ModelPicker
            models={tokenBilled}
            selected={modelId}
            onSelect={setModelId}
            family={family}
          />

          <FormForFamily
            modelId={modelId}
            family={family}
          />
        </div>

        <ResultRail modelId={modelId} family={family} />
      </div>

      <footer className="mt-auto border-t border-[var(--border)] px-10 py-6">
        <p className="max-w-3xl text-[12px] leading-relaxed text-[var(--text-subtle)]">
          Rate card pulled live from{' '}
          <code className="font-mono">/api/pricing</code> (sourced from{' '}
          <a
            href="https://ai.google.dev/pricing"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
          >
            ai.google.dev/pricing
          </a>
          ). Long-context tier crossover at 200K input tokens is automatic for
          Pro models. INR conversion uses {USD_TO_INR} ₹/USD. Estimates only —
          treat as a planning aid, not a billing statement.
        </p>
      </footer>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Model picker

function ModelPicker({
  models,
  selected,
  onSelect,
  family,
}: {
  models: { id: string; family: ModelFamily }[]
  selected: string
  onSelect: (id: string) => void
  family: ModelFamily
}) {
  const grouped = useMemo(() => {
    const out = new Map<ModelFamily, string[]>()
    for (const m of models) {
      const list = out.get(m.family) ?? []
      list.push(m.id)
      out.set(m.family, list)
    }
    return out
  }, [models])
  const order: ModelFamily[] = ['text', 'image-gen', 'video-gen', 'music', 'embeddings', 'live', 'tts', 'unknown']

  return (
    <Panel pad={false} className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          model · current family: {family}
        </span>
      </div>
      <div className="px-5 py-4">
        <select
          className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
        >
          {order.map((fam) => {
            const ids = grouped.get(fam)
            if (!ids || ids.length === 0) return null
            return (
              <optgroup key={fam} label={fam}>
                {ids.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </div>
    </Panel>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Form dispatcher — different inputs per family. Each form owns its state and
// pushes the computed CalcInputs up via context so ResultRail reads it.

type Listener = (inputs: CalcInputs | null) => void

type InputsBus = {
  publish: (next: CalcInputs | null) => void
  subscribe: (l: Listener) => () => void
  snapshot: () => CalcInputs | null
  assetUsd: number | undefined
}

function createInputsContext(): InputsBus {
  // Tiny inline event bus so the form and result rail can share state without
  // pulling in a router or a global store.
  let current: CalcInputs | null = null
  const listeners = new Set<Listener>()
  const bus: InputsBus = {
    publish(next) {
      current = next
      listeners.forEach((l) => l(current))
    },
    subscribe(l) {
      listeners.add(l)
      l(current)
      return () => {
        listeners.delete(l)
      }
    },
    snapshot: () => current,
    assetUsd: undefined,
  }
  return bus
}

const InputsContext = createInputsContext()

function FormForFamily({ modelId, family }: { modelId: string; family: ModelFamily }) {
  switch (family) {
    case 'text':
      return <TextForm modelId={modelId} />
    case 'image-gen':
      return <ImageGenForm modelId={modelId} />
    case 'video-gen':
      return <VideoGenForm modelId={modelId} />
    case 'music':
      return <MusicGenForm modelId={modelId} />
    case 'embeddings':
      return <EmbeddingsForm />
    case 'live':
      return <LiveForm />
    case 'tts':
      return <TTSForm />
    default:
      return (
        <Panel className="text-[13px] text-[var(--text-muted)]">
          Pick a token-billed model — calculator support for {family} models is
          rolling out next.
        </Panel>
      )
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Text form — the user's headline scenario lives here.

function TextForm({ modelId }: { modelId: string }) {
  const [promptText, setPromptText] = useState(2000)
  const [promptAudio, setPromptAudio] = useState(0)
  const [cachedText, setCachedText] = useState(0)
  const [cachedAudio, setCachedAudio] = useState(0)
  const [output, setOutput] = useState(500)
  const [thinking, setThinking] = useState(0)
  const [callsPerPeriod, setCallsPerPeriod] = useState(1)
  const [periodLabel, setPeriodLabel] = useState<'call' | 'minute' | 'hour' | 'day' | 'month'>('call')
  const [cacheStorageHours, setCacheStorageHours] = useState(0)

  // Throughput helper.
  const [tps, setTps] = useState(0)
  const [tpsMinutes, setTpsMinutes] = useState(60)

  useEffect(() => {
    const inputs: TextInputs = {
      kind: 'text',
      promptTextTokens: Math.max(0, promptText),
      promptAudioTokens: Math.max(0, promptAudio),
      cachedTextTokens: Math.max(0, cachedText),
      cachedAudioTokens: Math.max(0, cachedAudio),
      outputTokens: Math.max(0, output),
      thinkingTokens: Math.max(0, thinking),
      callsPerPeriod: Math.max(0, callsPerPeriod),
      cacheStorageHours: Math.max(0, cacheStorageHours),
    }
    InputsContext.publish(inputs)
  }, [promptText, promptAudio, cachedText, cachedAudio, output, thinking, callsPerPeriod, cacheStorageHours])

  // Re-publish on remount (e.g. when the user switches model families and back).
  useEffect(() => {
    return () => InputsContext.publish(null)
  }, [modelId])

  return (
    <Panel className="flex flex-col gap-5">
      <SectionTitle>workload — per call</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NumberField label="text input tokens" hint="prompt + image + video" value={promptText} onChange={setPromptText} />
        <NumberField label="audio input tokens" hint="32 tok/sec — separate rate on most Flash models" value={promptAudio} onChange={setPromptAudio} />
        <NumberField label="cached text tokens" hint="implicit + explicit cache hit" value={cachedText} onChange={setCachedText} />
        <NumberField label="cached audio tokens" hint="cached audio prefix" value={cachedAudio} onChange={setCachedAudio} />
        <NumberField label="output tokens" hint="model response" value={output} onChange={setOutput} />
        <NumberField label="thinking tokens" hint="reasoning — billed at output rate" value={thinking} onChange={setThinking} />
      </div>

      <SectionTitle>throughput helper</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NumberField label="tokens / sec output" hint='answers "what if I generate X tok/s"' value={tps} onChange={setTps} />
        <NumberField label="for how many minutes" hint="duration of the throughput burst" value={tpsMinutes} onChange={setTpsMinutes} />
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setOutput(throughputToOutputTokens(tps, tpsMinutes))}
            disabled={tps <= 0 || tpsMinutes <= 0}
            className="h-10 w-full rounded-[var(--radius-md)] bg-[var(--accent)] px-3 text-[13px] font-medium text-[oklch(16%_0_0)] disabled:opacity-40"
          >
            apply to output
          </button>
        </div>
      </div>
      {tps > 0 && tpsMinutes > 0 && (
        <p className="font-mono text-[12px] text-[var(--text-muted)]">
          → {throughputToOutputTokens(tps, tpsMinutes).toLocaleString()} output tokens
        </p>
      )}

      <SectionTitle>workload — period</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NumberField label="calls per period" hint="how many calls of this size" value={callsPerPeriod} onChange={setCallsPerPeriod} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>period</FieldLabel>
          <select
            className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value as 'call' | 'minute' | 'hour' | 'day' | 'month')}
          >
            <option value="call">per call</option>
            <option value="minute">per minute</option>
            <option value="hour">per hour</option>
            <option value="day">per day</option>
            <option value="month">per month</option>
          </select>
        </div>
        <NumberField
          label="cache storage hours"
          hint="0 to skip storage cost"
          value={cacheStorageHours}
          onChange={setCacheStorageHours}
          step={0.25}
        />
      </div>
      <ContextPublisher periodLabel={periodLabel} />
    </Panel>
  )
}

function ImageGenForm({ modelId }: { modelId: string }) {
  const schedule = IMAGE_PER_ASSET_USD[modelId] ?? {}
  const tiers = Object.keys(schedule)
  const [tier, setTier] = useState<string>(tiers[0] ?? '1K')
  const [numImages, setNumImages] = useState(1)
  const [promptTokens, setPromptTokens] = useState(50)
  const [callsPerPeriod, setCallsPerPeriod] = useState(1)

  useEffect(() => {
    if (tiers.length > 0 && !schedule[tier]) setTier(tiers[0])
  }, [modelId, tier, tiers, schedule])

  useEffect(() => {
    const fee = (schedule[tier] ?? 0) * numImages
    const inputs: ImageGenInputs = {
      kind: 'image-gen',
      promptTokens: Math.max(0, promptTokens),
      numImages: Math.max(0, numImages),
      resolutionTier: tier,
      callsPerPeriod: Math.max(0, callsPerPeriod),
    }
    InputsContext.publish(inputs)
    // The pure cost function returns null per-image fee; we surface it via
    // the rail by also publishing the asset-fee separately.
    InputsContext.assetUsd = fee
  }, [tier, numImages, promptTokens, callsPerPeriod, modelId, schedule])

  useEffect(() => () => { InputsContext.publish(null); InputsContext.assetUsd = undefined }, [])

  return (
    <Panel className="flex flex-col gap-5">
      <SectionTitle>image generation</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>resolution tier</FieldLabel>
          <select
            className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
          >
            {tiers.length === 0 && <option value="">(no schedule)</option>}
            {tiers.map((t) => (
              <option key={t} value={t}>
                {t} · ${schedule[t]?.toFixed(3)}/img
              </option>
            ))}
          </select>
        </div>
        <NumberField label="images per call" value={numImages} onChange={setNumImages} />
        <NumberField label="prompt tokens" value={promptTokens} onChange={setPromptTokens} />
      </div>
      <NumberField label="calls per period" value={callsPerPeriod} onChange={setCallsPerPeriod} />
      <ContextPublisher periodLabel="call" />
    </Panel>
  )
}

function VideoGenForm({ modelId }: { modelId: string }) {
  const schedule = VEO_PER_SECOND_USD[modelId] ?? {}
  const resolutions = Object.keys(schedule)
  const [resolution, setResolution] = useState<string>(resolutions[0] ?? '1080p')
  const [seconds, setSeconds] = useState(8)
  const [callsPerPeriod, setCallsPerPeriod] = useState(1)

  useEffect(() => {
    if (resolutions.length > 0 && !schedule[resolution]) setResolution(resolutions[0])
  }, [modelId, resolution, resolutions, schedule])

  useEffect(() => {
    const fee = (schedule[resolution] ?? 0) * seconds
    const inputs: VideoGenInputs = {
      kind: 'video-gen',
      seconds: Math.max(0, seconds),
      resolution,
      callsPerPeriod: Math.max(0, callsPerPeriod),
    }
    InputsContext.publish(inputs)
    InputsContext.assetUsd = fee
  }, [resolution, seconds, callsPerPeriod, modelId, schedule])

  useEffect(() => () => { InputsContext.publish(null); InputsContext.assetUsd = undefined }, [])

  return (
    <Panel className="flex flex-col gap-5">
      <SectionTitle>video generation</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>resolution</FieldLabel>
          <select
            className="h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          >
            {resolutions.length === 0 && <option value="">(no schedule)</option>}
            {resolutions.map((r) => (
              <option key={r} value={r}>
                {r} · ${schedule[r]?.toFixed(2)}/sec
              </option>
            ))}
          </select>
        </div>
        <NumberField label="seconds of video" hint="Veo defaults to 8 s clips" value={seconds} onChange={setSeconds} />
        <NumberField label="calls per period" value={callsPerPeriod} onChange={setCallsPerPeriod} />
      </div>
      <ContextPublisher periodLabel="call" />
    </Panel>
  )
}

function MusicGenForm({ modelId }: { modelId: string }) {
  const perSong = LYRIA_PER_SONG_USD[modelId] ?? 0
  const [songs, setSongs] = useState(1)
  const [callsPerPeriod, setCallsPerPeriod] = useState(1)

  useEffect(() => {
    const fee = perSong * songs
    const inputs: MusicGenInputs = {
      kind: 'music',
      songs: Math.max(0, songs),
      callsPerPeriod: Math.max(0, callsPerPeriod),
    }
    InputsContext.publish(inputs)
    InputsContext.assetUsd = fee
  }, [songs, callsPerPeriod, perSong])

  useEffect(() => () => { InputsContext.publish(null); InputsContext.assetUsd = undefined }, [])

  return (
    <Panel className="flex flex-col gap-5">
      <SectionTitle>music generation · ${perSong.toFixed(2)}/song</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NumberField label="songs per call" value={songs} onChange={setSongs} />
        <NumberField label="calls per period" value={callsPerPeriod} onChange={setCallsPerPeriod} />
      </div>
      <ContextPublisher periodLabel="call" />
    </Panel>
  )
}

function EmbeddingsForm() {
  const [textTokens, setTextTokens] = useState(10000)
  const [imageTokens, setImageTokens] = useState(0)
  const [audioTokens, setAudioTokens] = useState(0)
  const [videoTokens, setVideoTokens] = useState(0)
  const [callsPerPeriod, setCallsPerPeriod] = useState(1)
  useEffect(() => {
    const inputs: EmbeddingsInputs = {
      kind: 'embeddings',
      textTokens: Math.max(0, textTokens),
      imageTokens: Math.max(0, imageTokens),
      audioTokens: Math.max(0, audioTokens),
      videoTokens: Math.max(0, videoTokens),
      callsPerPeriod: Math.max(0, callsPerPeriod),
    }
    InputsContext.publish(inputs)
    InputsContext.assetUsd = undefined
  }, [textTokens, imageTokens, audioTokens, videoTokens, callsPerPeriod])
  useEffect(() => () => InputsContext.publish(null), [])
  return (
    <Panel className="flex flex-col gap-5">
      <SectionTitle>embeddings input</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NumberField label="text tokens" value={textTokens} onChange={setTextTokens} />
        <NumberField label="image tokens" hint="258 tok/tile (gemini-embedding-2)" value={imageTokens} onChange={setImageTokens} />
        <NumberField label="audio tokens" hint="32 tok/sec (gemini-embedding-2)" value={audioTokens} onChange={setAudioTokens} />
        <NumberField label="video tokens" hint="263 tok/sec (gemini-embedding-2)" value={videoTokens} onChange={setVideoTokens} />
        <NumberField label="calls per period" value={callsPerPeriod} onChange={setCallsPerPeriod} />
      </div>
      <ContextPublisher periodLabel="call" />
    </Panel>
  )
}

function LiveForm() {
  const [textIn, setTextIn] = useState(0)
  const [audioIn, setAudioIn] = useState(0)
  const [textOut, setTextOut] = useState(0)
  const [audioOut, setAudioOut] = useState(0)
  const [callsPerPeriod, setCallsPerPeriod] = useState(1)
  useEffect(() => {
    const inputs: LiveInputs = {
      kind: 'live',
      textInputTokens: Math.max(0, textIn),
      audioInputTokens: Math.max(0, audioIn),
      textOutputTokens: Math.max(0, textOut),
      audioOutputTokens: Math.max(0, audioOut),
      callsPerPeriod: Math.max(0, callsPerPeriod),
    }
    InputsContext.publish(inputs)
    InputsContext.assetUsd = undefined
  }, [textIn, audioIn, textOut, audioOut, callsPerPeriod])
  useEffect(() => () => InputsContext.publish(null), [])
  return (
    <Panel className="flex flex-col gap-5">
      <SectionTitle>live api session</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NumberField label="text input tokens" value={textIn} onChange={setTextIn} />
        <NumberField label="audio input tokens" hint="32 tok/sec" value={audioIn} onChange={setAudioIn} />
        <NumberField label="text output tokens" value={textOut} onChange={setTextOut} />
        <NumberField label="audio output tokens" value={audioOut} onChange={setAudioOut} />
        <NumberField label="sessions per period" value={callsPerPeriod} onChange={setCallsPerPeriod} />
      </div>
      <ContextPublisher periodLabel="session" />
    </Panel>
  )
}

function TTSForm() {
  const [textIn, setTextIn] = useState(500)
  const [audioOut, setAudioOut] = useState(2000)
  const [callsPerPeriod, setCallsPerPeriod] = useState(1)
  useEffect(() => {
    const inputs: TTSInputs = {
      kind: 'tts',
      textInputTokens: Math.max(0, textIn),
      audioOutputTokens: Math.max(0, audioOut),
      callsPerPeriod: Math.max(0, callsPerPeriod),
    }
    InputsContext.publish(inputs)
    InputsContext.assetUsd = undefined
  }, [textIn, audioOut, callsPerPeriod])
  useEffect(() => () => InputsContext.publish(null), [])
  return (
    <Panel className="flex flex-col gap-5">
      <SectionTitle>text-to-speech</SectionTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NumberField label="text input tokens" value={textIn} onChange={setTextIn} />
        <NumberField label="audio output tokens" value={audioOut} onChange={setAudioOut} />
        <NumberField label="calls per period" value={callsPerPeriod} onChange={setCallsPerPeriod} />
      </div>
      <ContextPublisher periodLabel="call" />
    </Panel>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Result rail — subscribes to the form's inputs, recomputes on every change.

function ResultRail({ modelId }: { modelId: string; family: ModelFamily }) {
  const pricing = usePricing((s) => s.data)
  const rate = rateFor(pricing, modelId)
  const [inputs, setInputs] = useState<CalcInputs | null>(null)

  useEffect(() => InputsContext.subscribe(setInputs), [])

  const baseline: CalcResult | null = useMemo(() => {
    if (!inputs) return null
    const r = computeCost(rate, inputs)
    // Asset fees (image / video / music) computed at the form layer because
    // the pure cost function can't see the rate-card-resident schedule.
    if (typeof InputsContext.assetUsd === 'number') {
      const assetUsd = InputsContext.assetUsd
      const callsPerPeriod = (inputs as { callsPerPeriod: number }).callsPerPeriod ?? 1
      r.parts.push({ label: 'asset fee', usd: assetUsd })
      r.perCallUsd += assetUsd
      r.periodUsd = r.perCallUsd * callsPerPeriod
    }
    return r
  }, [inputs, rate])

  const comparisons = useMemo(
    () => (rate && inputs && baseline ? buildComparisons(rate, inputs, baseline) : []),
    [rate, inputs, baseline],
  )

  const periodLabel = (inputs as unknown as { __period?: string })?.__period ?? 'call'

  return (
    <aside className="flex flex-col gap-4">
      <Panel className="flex flex-col gap-3">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          per call
        </span>
        <div className="flex items-baseline gap-2">
          <span className="numeric font-mono text-[34px] leading-none text-[var(--text)]">
            ${baseline ? baseline.perCallUsd.toFixed(6) : '0.000000'}
          </span>
          <span className="font-mono text-[12px] text-[var(--text-subtle)]">USD</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="numeric font-mono text-[18px] text-[var(--text-muted)]">
            ₹{baseline ? (baseline.perCallUsd * USD_TO_INR).toFixed(4) : '0.0000'}
          </span>
          <span className="font-mono text-[10.5px] text-[var(--text-subtle)]">INR</span>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-3">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          per {periodLabel} (× calls)
        </span>
        <div className="flex items-baseline gap-2">
          <span className="numeric font-mono text-[34px] leading-none text-[var(--accent)]">
            ${baseline ? baseline.periodUsd.toFixed(4) : '0.0000'}
          </span>
          <span className="font-mono text-[12px] text-[var(--text-subtle)]">USD</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="numeric font-mono text-[18px] text-[var(--text-muted)]">
            ₹{baseline ? (baseline.periodUsd * USD_TO_INR).toFixed(2) : '0.00'}
          </span>
          <span className="font-mono text-[10.5px] text-[var(--text-subtle)]">INR</span>
        </div>
      </Panel>

      {baseline && baseline.parts.length > 0 && (
        <Panel pad={false} className="overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
            <span
              className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
              style={{ letterSpacing: '0.28em' }}
            >
              breakdown · {baseline.tier}
            </span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {baseline.parts.map((p, i) => (
              <li
                key={i}
                className="flex items-baseline justify-between px-5 py-2.5"
              >
                <span className="text-[12.5px] text-[var(--text-muted)]">{p.label}</span>
                <span className="numeric font-mono text-[12.5px] text-[var(--text)]">
                  ${p.usd.toFixed(6)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {comparisons.length > 0 && (
        <Panel pad={false} className="overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
            <span
              className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
              style={{ letterSpacing: '0.28em' }}
            >
              what-ifs
            </span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {comparisons.map((c) => (
              <li key={c.label} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-[var(--text)]">{c.label}</span>
                  <div className="flex items-baseline gap-2">
                    <span className="numeric font-mono text-[13px] text-[var(--text)]">${c.usd.toFixed(4)}</span>
                    <span
                      className={cn(
                        'numeric font-mono text-[10.5px]',
                        c.delta_pct < 0
                          ? 'text-[var(--success)]'
                          : c.delta_pct > 0
                            ? 'text-[var(--danger)]'
                            : 'text-[var(--text-subtle)]',
                      )}
                    >
                      {c.delta_pct > 0 ? '+' : ''}
                      {c.delta_pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">{c.note}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {baseline && baseline.warnings.length > 0 && (
        <Panel className="flex items-start gap-3 border-[color-mix(in_oklch,var(--accent)_30%,var(--border))]">
          <AlertTriangle size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[var(--accent)]" />
          <ul className="flex flex-col gap-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {baseline.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="flex flex-col gap-2 bg-[var(--surface-raised)]">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          rate · {modelId}
        </span>
        {rate ? (
          <ul className="flex flex-col gap-1 font-mono text-[11.5px] text-[var(--text-muted)]">
            <li>input: ${rate.input_per_mtok_usd.toFixed(2)}/MTok</li>
            <li>output: ${rate.output_per_mtok_usd.toFixed(2)}/MTok</li>
            {rate.audio_input_per_mtok_usd != null && (
              <li>audio input: ${rate.audio_input_per_mtok_usd.toFixed(2)}/MTok</li>
            )}
            {rate.cached_input_per_mtok_usd != null && (
              <li>cached input: ${rate.cached_input_per_mtok_usd.toFixed(2)}/MTok</li>
            )}
            {rate.long_context_threshold_tokens != null && (
              <li>
                long-context above {rate.long_context_threshold_tokens.toLocaleString()} tokens — input
                ${rate.long_context_input_per_mtok_usd?.toFixed(2)} / output
                ${rate.long_context_output_per_mtok_usd?.toFixed(2)}
              </li>
            )}
            {rate.storage_per_mtok_per_hour_usd != null && (
              <li>cache storage: ${rate.storage_per_mtok_per_hour_usd.toFixed(2)}/MTok/hr</li>
            )}
            {rate.asset_note && <li className="text-[var(--accent)]">{rate.asset_note}</li>}
          </ul>
        ) : (
          <span className="text-[12.5px] text-[var(--text-subtle)]">no rate-card row</span>
        )}
        <a
          href="https://ai.google.dev/pricing"
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-baseline gap-1 font-mono text-[10.5px] uppercase text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
          style={{ letterSpacing: '0.18em' }}
        >
          verify on ai.google.dev/pricing
          <ExternalLink size={10} strokeWidth={1.5} className="translate-y-[1px]" />
        </a>
      </Panel>
    </aside>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Tiny form primitives — keep the form code compact.

function NumberField({
  label,
  value,
  onChange,
  hint,
  step = 1,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  hint?: string
  step?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <input
        type="number"
        min={0}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="numeric h-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 font-mono text-[13px] text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
      />
    </div>
  )
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.18em' }}
      >
        {children}
      </span>
      {hint && (
        <span className="text-[10.5px] text-[var(--text-subtle)]">{hint}</span>
      )}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-mono text-[10.5px] uppercase text-[var(--accent)]"
      style={{ letterSpacing: '0.28em' }}
    >
      {children}
    </h2>
  )
}

// Decorative — passes the period label through the inputs object so the rail
// can label the totals correctly. We piggy-back on the inputs context.
function ContextPublisher({ periodLabel }: { periodLabel: string }) {
  useEffect(() => {
    const cur = InputsContext.snapshot()
    if (cur) (cur as unknown as { __period?: string }).__period = periodLabel
    InputsContext.publish(cur)
  }, [periodLabel])
  return null
}

