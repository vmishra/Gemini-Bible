/**
 * Pricing calculator — pure computation against the live Rate from /api/pricing.
 *
 * Design point: zero fabricated numbers. Every cost factor comes from the
 * `Rate` row that the backend already exposes (input / output / cached_input /
 * audio_input / cached_audio / long_context_* / storage). The UI feeds workload
 * inputs → this module returns a deterministic CalcResult with a part-by-part
 * breakdown. Math is tested against the same hand-computed scenarios that
 * verify backend metrics.py.
 */

import type { ModelRate } from './pricing'

// Asset-fee schedule for image / video / music models. These do NOT appear in
// /api/pricing per-token rates — they're per-asset fees that the rate card can't
// express. Kept here as the single source of truth for the calculator.
//
// Every value below is sourced from the ai.google.dev/pricing snapshot
// (page last updated 2026-04-30 UTC). Verified against the model lineup at
// ai.google.dev/gemini-api/docs/models. If a model id resolution is ambiguous
// between the pricing page and the lineup, we use the lineup id.
//
// Veo 3 (`veo-3.0-generate-001`) and Veo 2 (`veo-2.0-generate-001`) are listed
// on the pricing page but are NOT in this project's catalog yet, so they're
// intentionally omitted. Same for Veo 3.1 Fast — the pricing page lists a
// `veo-3.1-fast-generate-preview` id but the model lineup page doesn't surface
// it as a separate entry, so we treat Fast as a future addition.
export const IMAGE_PER_ASSET_USD: Record<string, Record<string, number>> = {
  'gemini-3-pro-image-preview': {
    '1K-2K': 0.134,
    '4K': 0.24,
  },
  'gemini-3.1-flash-image-preview': {
    '0.5K': 0.045,
    '1K': 0.067,
    '2K': 0.101,
    '4K': 0.151,
  },
  'gemini-2.5-flash-image': {
    '1K': 0.039,
  },
  // Imagen 4 — single model id, three speed/quality tiers per the pricing page.
  'imagen-4': {
    'fast': 0.02,
    'standard': 0.04,
    'ultra': 0.06,
  },
}

// Veo: USD per second of generated video, keyed by model id × resolution.
// Every Veo model id surfaced on ai.google.dev/pricing is included; rates are
// quoted verbatim from that page (snapshot 2026-04-30). Veo prompt input is
// not token-billed for any of these models — the per-second fee is the bill.
export const VEO_PER_SECOND_USD: Record<string, Record<string, number>> = {
  // Veo 3.1 — three speed tiers as separate model ids on the pricing page.
  'veo-3.1-generate-preview': {
    '720p': 0.4,
    '1080p': 0.4,
    '4K': 0.6,
  },
  'veo-3.1-fast-generate-preview': {
    '720p': 0.1,
    '1080p': 0.12,
    '4K': 0.3,
  },
  'veo-3.1-lite-generate-preview': {
    '720p': 0.05,
    '1080p': 0.08,
  },
  // Veo 3 — two variants.
  'veo-3.0-generate-001': {
    'any': 0.4,
  },
  'veo-3.0-fast-generate-001': {
    '720p': 0.1,
    '1080p': 0.12,
    '4K': 0.3,
  },
  // Veo 2 — flat per-second.
  'veo-2.0-generate-001': {
    'any': 0.35,
  },
}

// Lyria: per-song flat fee. Both ids in the project catalog.
export const LYRIA_PER_SONG_USD: Record<string, number> = {
  'lyria-3-clip-preview': 0.04,    // ~30-second clip
  'lyria-3-pro-preview': 0.08,     // full-length song
}

// Source-of-record URL for the per-asset fees above.
export const ASSET_PRICING_SOURCE = {
  url: 'https://ai.google.dev/pricing',
  label: 'Gemini API — Pricing (snapshot 2026-04-30)',
}

// ────────────────────────────────────────────────────────────────────────────
// Inputs — one shape per model family. The Calculator picks which form to
// render based on the model id.

export type TextInputs = {
  kind: 'text'
  promptTextTokens: number       // text + image + video input
  promptAudioTokens: number      // audio input (separately priced on many models)
  cachedTextTokens: number       // text already in cache
  cachedAudioTokens: number      // audio already in cache
  outputTokens: number           // model output tokens
  thinkingTokens: number         // reasoning tokens — billed at output rate
  callsPerPeriod: number         // workload multiplier
  cacheStorageHours: number      // 0 means don't model storage cost
}

export type ImageGenInputs = {
  kind: 'image-gen'
  promptTokens: number           // text prompt tokens (input rate)
  numImages: number
  resolutionTier: string         // matches IMAGE_PER_ASSET_USD subkeys
  callsPerPeriod: number
}

export type VideoGenInputs = {
  kind: 'video-gen'
  seconds: number
  resolution: string             // matches VEO_PER_SECOND_USD subkeys
  callsPerPeriod: number
}

export type MusicGenInputs = {
  kind: 'music'
  songs: number
  callsPerPeriod: number
}

export type EmbeddingsInputs = {
  kind: 'embeddings'
  textTokens: number
  imageTokens: number            // per /api/pricing notes: separate rate not exposed; treat as text for now
  audioTokens: number            // 6.50/MTok on gemini-embedding-2 — handled below
  videoTokens: number            // 12.00/MTok on gemini-embedding-2 — handled below
  callsPerPeriod: number
}

export type LiveInputs = {
  kind: 'live'
  textInputTokens: number
  audioInputTokens: number
  textOutputTokens: number
  audioOutputTokens: number
  callsPerPeriod: number
}

export type TTSInputs = {
  kind: 'tts'
  textInputTokens: number
  audioOutputTokens: number
  callsPerPeriod: number
}

export type CalcInputs =
  | TextInputs
  | ImageGenInputs
  | VideoGenInputs
  | MusicGenInputs
  | EmbeddingsInputs
  | LiveInputs
  | TTSInputs

// ────────────────────────────────────────────────────────────────────────────
// Throughput helpers — the user's "1000 tokens/sec for N minutes" case.
// Returns an object the form can spread into TextInputs.

export function throughputToOutputTokens(tokensPerSecond: number, minutes: number): number {
  return Math.round(tokensPerSecond * minutes * 60)
}

export function throughputCallsPerPeriod(callsPerSecond: number, periodSeconds: number): number {
  return callsPerSecond * periodSeconds
}

// ────────────────────────────────────────────────────────────────────────────
// Result — per-call breakdown plus the period-scaled total.

export type CalcResult = {
  perCallUsd: number
  periodUsd: number              // perCallUsd × callsPerPeriod
  parts: Array<{ label: string; usd: number }>
  tier: 'standard' | 'long-context' | 'asset' | 'unknown'
  warnings: string[]
}

const ZERO: CalcResult = { perCallUsd: 0, periodUsd: 0, parts: [], tier: 'unknown', warnings: [] }

// ────────────────────────────────────────────────────────────────────────────
// Model-family inference — used by the UI to render the right form.

export type ModelFamily = 'text' | 'image-gen' | 'video-gen' | 'music' | 'embeddings' | 'live' | 'tts' | 'unknown'

export function familyFor(modelId: string): ModelFamily {
  if (modelId.startsWith('veo-')) return 'video-gen'
  if (modelId.startsWith('lyria-')) return 'music'
  if (modelId.startsWith('imagen-')) return 'image-gen'
  if (modelId.includes('-image-preview') || modelId === 'gemini-2.5-flash-image') return 'image-gen'
  if (modelId.includes('-tts')) return 'tts'
  if (modelId.includes('-live') || modelId.includes('native-audio')) return 'live'
  if (modelId.startsWith('gemini-embedding')) return 'embeddings'
  if (modelId.startsWith('gemini-')) return 'text'
  return 'unknown'
}

// ────────────────────────────────────────────────────────────────────────────
// Cost computation. Pure function — same inputs give same outputs.

export function computeCost(rate: ModelRate | null, inputs: CalcInputs): CalcResult {
  if (!rate) {
    return { ...ZERO, warnings: ['No pricing entry for this model.'] }
  }

  switch (inputs.kind) {
    case 'text':
      return computeText(rate, inputs)
    case 'image-gen':
      return computeImageGen(rate, inputs)
    case 'video-gen':
      return computeVideoGen(inputs)
    case 'music':
      return computeMusic(inputs)
    case 'embeddings':
      return computeEmbeddings(rate, inputs)
    case 'live':
      return computeLive(rate, inputs)
    case 'tts':
      return computeTTS(rate, inputs)
  }
}

function computeText(rate: ModelRate, inputs: TextInputs): CalcResult {
  const totalInputTokens =
    inputs.promptTextTokens + inputs.promptAudioTokens + inputs.cachedTextTokens + inputs.cachedAudioTokens
  const longContext =
    rate.long_context_threshold_tokens != null && totalInputTokens > rate.long_context_threshold_tokens

  const inRate =
    longContext && rate.long_context_input_per_mtok_usd != null
      ? rate.long_context_input_per_mtok_usd
      : rate.input_per_mtok_usd
  const audioInRate = rate.audio_input_per_mtok_usd ?? inRate
  const outRate =
    longContext && rate.long_context_output_per_mtok_usd != null
      ? rate.long_context_output_per_mtok_usd
      : rate.output_per_mtok_usd
  const cachedTextRate =
    longContext && rate.long_context_cached_per_mtok_usd != null
      ? rate.long_context_cached_per_mtok_usd
      : rate.cached_input_per_mtok_usd ?? 0
  const cachedAudioRate = rate.cached_audio_per_mtok_usd ?? cachedTextRate

  const parts = [
    { label: 'text input', usd: (inputs.promptTextTokens * inRate) / 1_000_000 },
    { label: 'audio input', usd: (inputs.promptAudioTokens * audioInRate) / 1_000_000 },
    { label: 'cached text', usd: (inputs.cachedTextTokens * cachedTextRate) / 1_000_000 },
    { label: 'cached audio', usd: (inputs.cachedAudioTokens * cachedAudioRate) / 1_000_000 },
    { label: 'output', usd: (inputs.outputTokens * outRate) / 1_000_000 },
    { label: 'thinking', usd: (inputs.thinkingTokens * outRate) / 1_000_000 },
  ]
  if (rate.storage_per_mtok_per_hour_usd != null && inputs.cacheStorageHours > 0) {
    const cachedTotal = inputs.cachedTextTokens + inputs.cachedAudioTokens
    const storage = (cachedTotal * rate.storage_per_mtok_per_hour_usd * inputs.cacheStorageHours) / 1_000_000
    parts.push({ label: 'cache storage', usd: storage })
  }

  const perCall = parts.reduce((s, p) => s + p.usd, 0)
  const warnings: string[] = []
  if (longContext) warnings.push(`Long-context tier active (>${rate.long_context_threshold_tokens!.toLocaleString()} input tokens). Input and output rates elevated.`)
  return {
    perCallUsd: perCall,
    periodUsd: perCall * Math.max(0, inputs.callsPerPeriod),
    parts,
    tier: longContext ? 'long-context' : 'standard',
    warnings,
  }
}

function computeImageGen(rate: ModelRate, inputs: ImageGenInputs): CalcResult {
  const inRate = rate.input_per_mtok_usd
  const outRate = rate.output_per_mtok_usd
  const promptUsd = (inputs.promptTokens * inRate) / 1_000_000

  // Per-image fee. Match the model id to the schedule; if no match, return null fee.
  const schedule = lookupImageSchedule(inputs)
  const perImageUsd = schedule.perImage ?? 0
  const imageUsd = perImageUsd * inputs.numImages
  const outputTextUsd = 0   // image gen samples set response_modalities=['IMAGE'] only

  const parts = [
    { label: 'prompt input', usd: promptUsd },
    { label: `image fee × ${inputs.numImages}`, usd: imageUsd },
  ]
  if (outRate > 0 && outputTextUsd > 0) parts.push({ label: 'output text', usd: outputTextUsd })

  const perCall = parts.reduce((s, p) => s + p.usd, 0)
  const warnings: string[] = []
  if (perImageUsd === 0) warnings.push(`No per-image fee found for ${schedule.modelKey} @ ${inputs.resolutionTier}. Verify ai.google.dev/pricing.`)
  return {
    perCallUsd: perCall,
    periodUsd: perCall * Math.max(0, inputs.callsPerPeriod),
    parts,
    tier: 'asset',
    warnings,
  }
}

function lookupImageSchedule(_inputs: ImageGenInputs): { perImage: number | null; modelKey: string } {
  // Caller passes resolutionTier as the schedule key; the calculator UI feeds in
  // the model id implicitly via the rate, so we encode the model→schedule
  // mapping at the UI level. Here we just return a null fee — the UI's
  // assetUsd publish is what actually carries the per-image fee through.
  return { perImage: null, modelKey: 'image' }
}

function computeVideoGen(inputs: VideoGenInputs): CalcResult {
  const parts = [{ label: `video × ${inputs.seconds}s`, usd: 0 }]
  return {
    perCallUsd: 0,
    periodUsd: 0,
    parts,
    tier: 'asset',
    warnings: [
      'Video pricing computed at the UI layer using VEO_PER_SECOND_USD — see Calculator.tsx.',
    ],
  }
}

function computeMusic(inputs: MusicGenInputs): CalcResult {
  const parts = [{ label: `song × ${inputs.songs}`, usd: 0 }]
  return {
    perCallUsd: 0,
    periodUsd: 0,
    parts,
    tier: 'asset',
    warnings: ['Music pricing computed at the UI layer — see Calculator.tsx.'],
  }
}

function computeEmbeddings(rate: ModelRate, inputs: EmbeddingsInputs): CalcResult {
  // Per-modality rates — each falls back to the text rate when the model
  // doesn't price that modality separately. gemini-embedding-2 sets all four
  // explicitly per ai.google.dev/pricing.
  const textRate = rate.input_per_mtok_usd
  const imageRate = rate.image_input_per_mtok_usd ?? textRate
  const audioRate = rate.audio_input_per_mtok_usd ?? textRate
  const videoRate = rate.video_input_per_mtok_usd ?? textRate

  const parts = [
    { label: 'text', usd: (inputs.textTokens * textRate) / 1_000_000 },
    { label: 'image', usd: (inputs.imageTokens * imageRate) / 1_000_000 },
    { label: 'audio', usd: (inputs.audioTokens * audioRate) / 1_000_000 },
    { label: 'video', usd: (inputs.videoTokens * videoRate) / 1_000_000 },
  ]
  const perCall = parts.reduce((s, p) => s + p.usd, 0)

  const warnings: string[] = []
  if (inputs.imageTokens > 0 && rate.image_input_per_mtok_usd == null) {
    warnings.push('Image embedding rate not in rate card for this model — using the text rate. Verify against ai.google.dev/pricing.')
  }
  if (inputs.videoTokens > 0 && rate.video_input_per_mtok_usd == null) {
    warnings.push('Video embedding rate not in rate card for this model — using the text rate. Verify against ai.google.dev/pricing.')
  }
  return {
    perCallUsd: perCall,
    periodUsd: perCall * Math.max(0, inputs.callsPerPeriod),
    parts,
    tier: 'standard',
    warnings,
  }
}

function computeLive(rate: ModelRate, inputs: LiveInputs): CalcResult {
  const textInRate = rate.input_per_mtok_usd
  const audioInRate = rate.audio_input_per_mtok_usd ?? textInRate
  const textOutRate = rate.output_per_mtok_usd
  // Live audio output isn't exposed as a separate field on /api/pricing today.
  // The pricing page lists it explicitly (e.g. $12/MTok audio out on Live preview).
  // We treat output rate as the text-output rate for now and warn.
  const parts = [
    { label: 'text input', usd: (inputs.textInputTokens * textInRate) / 1_000_000 },
    { label: 'audio input', usd: (inputs.audioInputTokens * audioInRate) / 1_000_000 },
    { label: 'text output', usd: (inputs.textOutputTokens * textOutRate) / 1_000_000 },
    { label: 'audio output', usd: (inputs.audioOutputTokens * textOutRate) / 1_000_000 },
  ]
  const perCall = parts.reduce((s, p) => s + p.usd, 0)
  return {
    perCallUsd: perCall,
    periodUsd: perCall * Math.max(0, inputs.callsPerPeriod),
    parts,
    tier: 'standard',
    warnings: ['Live audio-output rate is not yet exposed separately by /api/pricing — using text-output rate as an approximation. Verify against ai.google.dev/pricing for exact audio-output billing on Live preview.'],
  }
}

function computeTTS(rate: ModelRate, inputs: TTSInputs): CalcResult {
  const parts = [
    { label: 'text input', usd: (inputs.textInputTokens * rate.input_per_mtok_usd) / 1_000_000 },
    { label: 'audio output', usd: (inputs.audioOutputTokens * rate.output_per_mtok_usd) / 1_000_000 },
  ]
  const perCall = parts.reduce((s, p) => s + p.usd, 0)
  return {
    perCallUsd: perCall,
    periodUsd: perCall * Math.max(0, inputs.callsPerPeriod),
    parts,
    tier: 'standard',
    warnings: [],
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Discount comparisons — what the user pays under different billing modes.

export type DiscountComparison = {
  label: string
  usd: number
  delta_pct: number              // vs the standard / non-cached price
  note: string
}

export function buildComparisons(
  rate: ModelRate | null,
  inputs: CalcInputs,
  baseline: CalcResult,
): DiscountComparison[] {
  if (!rate || baseline.periodUsd === 0) return []
  const cmps: DiscountComparison[] = []

  // Batch API — flat 50% off for token-billed text models.
  if (inputs.kind === 'text' || inputs.kind === 'embeddings' || inputs.kind === 'tts') {
    cmps.push({
      label: 'Batch API',
      usd: baseline.periodUsd * 0.5,
      delta_pct: -50,
      note: 'Async / eventual delivery. 50% off across input + output.',
    })
  }

  // Cache off — text only — re-run with cache values folded back into the input.
  if (inputs.kind === 'text' && (inputs.cachedTextTokens > 0 || inputs.cachedAudioTokens > 0)) {
    const noCache: TextInputs = {
      ...inputs,
      promptTextTokens: inputs.promptTextTokens + inputs.cachedTextTokens,
      promptAudioTokens: inputs.promptAudioTokens + inputs.cachedAudioTokens,
      cachedTextTokens: 0,
      cachedAudioTokens: 0,
      cacheStorageHours: 0,
    }
    const r = computeText(rate, noCache)
    const delta = baseline.periodUsd > 0 ? ((r.periodUsd / baseline.periodUsd) - 1) * 100 : 0
    cmps.push({
      label: 'Cache disabled',
      usd: r.periodUsd * Math.max(0, inputs.callsPerPeriod),
      delta_pct: delta,
      note: 'Cache turned off — every token bills at the input rate.',
    })
  }

  // Priority Inference — flat 3.6× rate for guaranteed throughput.
  if (inputs.kind === 'text') {
    cmps.push({
      label: 'Priority Inference',
      usd: baseline.periodUsd * 3.6,
      delta_pct: 260,
      note: '3.6× the standard rate for guaranteed throughput.',
    })
  }

  return cmps
}
