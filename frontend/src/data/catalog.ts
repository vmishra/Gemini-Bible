/**
 * Editorial layer over the Gemini family — pricing comes from /api/pricing,
 * but the family grouping, tier ranking, and when-to-use copy live here.
 *
 * Keep this honest: only assert capabilities the model actually has, only
 * suggest a use when you'd defend it in a customer call.
 */

export type ModelTier = 'flagship' | 'workhorse' | 'lite' | 'prior' | 'preview' | 'experimental'

export type ModelEntry = {
  id: string                       // Canonical model id used in API calls.
  display: string                  // Human-readable name.
  tier: ModelTier
  modalities: {
    input: ('text' | 'image' | 'audio' | 'video' | 'pdf')[]
    output: ('text' | 'image' | 'audio' | 'video' | 'embedding')[]
  }
  context_window?: string          // Free-form, e.g. "1M tokens"; omit when unknown.
  when_to_use: string              // One-line.
  capabilities: string[]           // Short tags: streaming, tools, grounding-search, thinking, structured-output, ...
  notes?: string                   // Optional second line; used sparingly.
}

export type ModelFamily = {
  id: string
  label: string                    // e.g. "Text and multimodal"
  kicker: string                   // Two-or-three-word kicker for the section header.
  blurb: string                    // One-sentence explanation of what the family is for.
  models: ModelEntry[]
}

export const FAMILIES: ModelFamily[] = [
  {
    id: 'text',
    label: 'Text and multimodal',
    kicker: 'reasoning',
    blurb:
      'The default surface. All models accept text, image, audio, video, and PDF input; differ on intelligence, latency, and cost.',
    models: [
      {
        id: 'gemini-3.1-pro-preview',
        display: 'Gemini 3.1 Pro',
        tier: 'flagship',
        modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'], output: ['text'] },
        context_window: '1M tokens',
        when_to_use:
          'Hardest reasoning, agentic plans, deep coding. Reach for it when 3 Flash struggles.',
        capabilities: ['thinking', 'tools', 'grounding-search', 'grounding-maps', 'structured-output', 'context-cache'],
      },
      {
        id: 'gemini-3-flash-preview',
        display: 'Gemini 3 Flash',
        tier: 'workhorse',
        modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'], output: ['text'] },
        context_window: '1M tokens',
        when_to_use:
          'Default for most workloads. Balanced speed, cost, and capability — start here.',
        capabilities: ['thinking', 'tools', 'grounding-search', 'grounding-maps', 'structured-output', 'context-cache', 'streaming', 'chat'],
      },
      {
        id: 'gemini-3.1-flash-lite-preview',
        display: 'Gemini 3.1 Flash-Lite',
        tier: 'lite',
        modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'], output: ['text'] },
        context_window: '1M tokens',
        when_to_use:
          'Highest QPS at the lowest unit cost. Routing, classification, simple extraction.',
        capabilities: ['tools', 'structured-output', 'streaming', 'chat'],
      },
      {
        id: 'gemini-2.5-pro',
        display: 'Gemini 2.5 Pro',
        tier: 'prior',
        modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'], output: ['text'] },
        context_window: '2M tokens',
        when_to_use:
          'Prior-gen flagship. Pin it if you have validated against it and aren’t ready to migrate.',
        capabilities: ['thinking', 'tools', 'grounding-search', 'structured-output', 'context-cache'],
      },
      {
        id: 'gemini-2.5-flash',
        display: 'Gemini 2.5 Flash',
        tier: 'prior',
        modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'], output: ['text'] },
        context_window: '1M tokens',
        when_to_use:
          'Stable workhorse from the prior generation. Useful as a baseline while evaluating 3 Flash.',
        capabilities: ['thinking', 'tools', 'grounding-search', 'structured-output', 'context-cache', 'streaming', 'chat'],
      },
      {
        id: 'gemini-2.5-flash-lite',
        display: 'Gemini 2.5 Flash-Lite',
        tier: 'prior',
        modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'], output: ['text'] },
        context_window: '1M tokens',
        when_to_use:
          'Prior-gen Lite. Migrate to 3.1 Flash-Lite when you can — equivalent shape at a lower price.',
        capabilities: ['tools', 'structured-output', 'streaming', 'chat'],
      },
    ],
  },
  {
    id: 'live',
    label: 'Live and realtime',
    kicker: 'voice',
    blurb:
      'Bidirectional sessions over a WebSocket. Sub-second turn-taking, native audio in and out, interruption handling.',
    models: [
      {
        id: 'gemini-3.1-flash-live-preview',
        display: 'Gemini 3.1 Flash Live',
        tier: 'workhorse',
        modalities: { input: ['text', 'audio', 'video'], output: ['text', 'audio'] },
        when_to_use:
          'Voice agents and copilots needing low-latency, full-duplex turn-taking with native audio.',
        capabilities: ['live-session', 'streaming-audio', 'tools'],
      },
      {
        id: 'gemini-2.5-flash-native-audio-preview-12-2025',
        display: 'Gemini 2.5 Flash Native Audio',
        tier: 'prior',
        modalities: { input: ['text', 'audio', 'video'], output: ['text', 'audio'] },
        when_to_use:
          'Prior-gen native-audio Live model. Hold here only if you have prod traffic dependent on its specific voice profile.',
        capabilities: ['live-session', 'streaming-audio'],
      },
    ],
  },
  {
    id: 'speech',
    label: 'Speech (TTS)',
    kicker: 'voice',
    blurb:
      'Standalone text-to-speech. Single or multi-speaker, 30 prebuilt voices, natural-language style control via inline tags ([whispers], [excitedly]).',
    models: [
      {
        id: 'gemini-3.1-flash-tts-preview',
        display: 'Gemini 3.1 Flash TTS',
        tier: 'flagship',
        modalities: { input: ['text'], output: ['audio'] },
        when_to_use:
          'Latest TTS. Single + multi-speaker audio with prebuilt voices and natural-language style control.',
        capabilities: ['tts', 'multi-speaker', 'style-control'],
      },
      {
        id: 'gemini-2.5-pro-preview-tts',
        display: 'Gemini 2.5 Pro TTS',
        tier: 'prior',
        modalities: { input: ['text'], output: ['audio'] },
        when_to_use:
          'Prior-gen Pro TTS. Hold here only if you have validated voice profiles in production.',
        capabilities: ['tts', 'multi-speaker'],
      },
      {
        id: 'gemini-2.5-flash-preview-tts',
        display: 'Gemini 2.5 Flash TTS',
        tier: 'prior',
        modalities: { input: ['text'], output: ['audio'] },
        when_to_use: 'Prior-gen Flash TTS. Cheaper baseline; migrate to 3.1 Flash TTS when you can.',
        capabilities: ['tts', 'multi-speaker'],
      },
    ],
  },
  {
    id: 'image',
    label: 'Image generation',
    kicker: 'pixels',
    blurb:
      'The Nano Banana family generates and edits images natively from a Gemini call. Imagen 4 is the dedicated text-to-image engine.',
    models: [
      {
        id: 'gemini-3-pro-image-preview',
        display: 'Nano Banana Pro',
        tier: 'flagship',
        modalities: { input: ['text', 'image'], output: ['image', 'text'] },
        when_to_use:
          'Studio-grade output up to 4K. Marketing assets, hero shots, anything that ships externally.',
        capabilities: ['image-gen', 'image-edit', '4k'],
      },
      {
        id: 'gemini-3.1-flash-image-preview',
        display: 'Nano Banana 2',
        tier: 'workhorse',
        modalities: { input: ['text', 'image'], output: ['image', 'text'] },
        when_to_use: 'Production-scale generation at 1024 px. The default for batched creative work.',
        capabilities: ['image-gen', 'image-edit'],
      },
      {
        id: 'gemini-2.5-flash-image',
        display: 'Nano Banana',
        tier: 'prior',
        modalities: { input: ['text', 'image'], output: ['image', 'text'] },
        when_to_use: 'Prior-gen Nano Banana. Migrate to 3.1 Flash Image — same price, sharper output.',
        capabilities: ['image-gen', 'image-edit'],
      },
      {
        id: 'imagen-4',
        display: 'Imagen 4',
        tier: 'flagship',
        modalities: { input: ['text'], output: ['image'] },
        when_to_use:
          'Pure text-to-image when you don’t need Gemini reasoning around the image. Clean, fast, up to 2K.',
        capabilities: ['image-gen'],
      },
    ],
  },
  {
    id: 'video',
    label: 'Video generation',
    kicker: 'frames',
    blurb:
      'Veo 3.1 generates short clips with native audio. The call returns a long-running operation; poll until done.',
    models: [
      {
        id: 'veo-3.1-generate-preview',
        display: 'Veo 3.1',
        tier: 'flagship',
        modalities: { input: ['text', 'image'], output: ['video'] },
        when_to_use:
          'Cinema-grade short video with synchronized audio. Hero spots, product reveals, finished cuts.',
        capabilities: ['video-gen', 'native-audio'],
      },
      {
        id: 'veo-3.1-fast-generate-preview',
        display: 'Veo 3.1 Fast',
        tier: 'workhorse',
        modalities: { input: ['text', 'image'], output: ['video'] },
        when_to_use:
          'Quarter the per-second cost of Veo 3.1 Standard. Good for iteration and large batch runs where shots will be re-cut anyway.',
        capabilities: ['video-gen'],
      },
      {
        id: 'veo-3.1-lite-generate-preview',
        display: 'Veo 3.1 Lite',
        tier: 'lite',
        modalities: { input: ['text', 'image'], output: ['video'] },
        when_to_use:
          'Cheapest Veo tier (no 4K). High-volume short-form output where the bar is "watchable", not "cinematic".',
        capabilities: ['video-gen'],
      },
      {
        id: 'veo-3.0-generate-001',
        display: 'Veo 3',
        tier: 'prior',
        modalities: { input: ['text', 'image'], output: ['video'] },
        when_to_use:
          "Prior-gen Veo flagship. Pin only if you have validated against this exact model and aren't ready to migrate to 3.1.",
        capabilities: ['video-gen'],
      },
      {
        id: 'veo-3.0-fast-generate-001',
        display: 'Veo 3 Fast',
        tier: 'prior',
        modalities: { input: ['text', 'image'], output: ['video'] },
        when_to_use:
          'Prior-gen Fast tier. Migrate to 3.1 Fast when you can — same shape, sharper output.',
        capabilities: ['video-gen'],
      },
      {
        id: 'veo-2.0-generate-001',
        display: 'Veo 2',
        tier: 'prior',
        modalities: { input: ['text', 'image'], output: ['video'] },
        when_to_use:
          'Two-gen-old. Use only if you have prod traffic dependent on it; otherwise migrate.',
        capabilities: ['video-gen'],
      },
    ],
  },
  {
    id: 'embeddings',
    label: 'Embeddings',
    kicker: 'vectors',
    blurb:
      'Dense vectors for retrieval, semantic search, RAG. Configurable output dimensionality.',
    models: [
      {
        id: 'gemini-embedding-2',
        display: 'gemini-embedding-2',
        tier: 'workhorse',
        modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'], output: ['embedding'] },
        when_to_use:
          'Default embeddings model. Multimodal input, fold task instructions into the prompt text.',
        capabilities: ['embeddings', 'multimodal-input', 'configurable-dim'],
      },
      {
        id: 'gemini-embedding-001',
        display: 'gemini-embedding-001',
        tier: 'prior',
        modalities: { input: ['text'], output: ['embedding'] },
        when_to_use:
          'Prior-gen embeddings. Use when you specifically need the task_type parameter (RETRIEVAL_DOCUMENT etc.).',
        capabilities: ['embeddings', 'task-type'],
      },
    ],
  },
  {
    id: 'music',
    label: 'Music generation',
    kicker: 'audio',
    blurb:
      'Lyria models generate musical audio from text. Pro for full-length compositions; Realtime for streaming generation with control inputs.',
    models: [
      {
        id: 'lyria-3-pro-preview',
        display: 'Lyria 3 Pro',
        tier: 'flagship',
        modalities: { input: ['text'], output: ['audio'] },
        when_to_use: 'Full-length music generation from prompt and structure.',
        capabilities: ['music-gen'],
      },
      {
        id: 'lyria-3-clip-preview',
        display: 'Lyria 3 Clip',
        tier: 'workhorse',
        modalities: { input: ['text'], output: ['audio'] },
        when_to_use: 'Short clips up to 30 seconds — UI cues, stings, idents.',
        capabilities: ['music-gen'],
      },
      {
        id: 'lyria-realtime-exp',
        display: 'Lyria Realtime',
        tier: 'experimental',
        modalities: { input: ['text'], output: ['audio'] },
        when_to_use: 'Streaming music generation with granular control. Experimental.',
        capabilities: ['music-gen', 'streaming-audio'],
      },
    ],
  },
  {
    id: 'specialized',
    label: 'Specialized and experimental',
    kicker: 'previews',
    blurb:
      'Purpose-built models for browser automation, deep research, and robotics. Treat as preview unless explicitly marked GA.',
    models: [
      {
        id: 'gemini-2.5-computer-use-preview-10-2025',
        display: 'Gemini Computer Use',
        tier: 'experimental',
        modalities: { input: ['text', 'image'], output: ['text'] },
        when_to_use: 'Automating real browser tasks via UI interaction. Treat as preview.',
        capabilities: ['computer-use', 'tools'],
      },
      {
        id: 'deep-research-preview-04-2026',
        display: 'Deep Research',
        tier: 'experimental',
        modalities: { input: ['text'], output: ['text'] },
        when_to_use:
          'Multi-step agentic research over hundreds of sources. Long-running, expensive — pick the model deliberately.',
        capabilities: ['deep-research', 'agentic'],
      },
      {
        id: 'gemini-robotics-er-1.6-preview',
        display: 'Gemini Robotics ER 1.6',
        tier: 'experimental',
        modalities: { input: ['text', 'image', 'video'], output: ['text'] },
        when_to_use:
          'Embodied reasoning for robotics planning. Spatial understanding, task decomposition for actuators.',
        capabilities: ['embodied'],
      },
    ],
  },
]

/**
 * Supergroups cluster related families under a single editorial banner.
 * GenMedia is the canonical example — image, video, and music live together
 * because the customer decision is "I want generated media" before it is
 * "I want pixels vs frames vs notes". Families not in any supergroup render
 * as standalone top-level sections.
 */
export type Supergroup = {
  id: string
  label: string
  kicker: string
  blurb: string
  family_ids: string[]
}

export const SUPERGROUPS: Supergroup[] = [
  {
    id: 'genmedia',
    label: 'GenMedia',
    kicker: 'creative output',
    blurb:
      'Generative output across pixels, frames, and audio. Image and video share the Nano Banana / Veo lineage; music sits with Lyria; speech is the standalone TTS line. Asset-billed, not token-billed — refer to per-model notes.',
    family_ids: ['image', 'video', 'music', 'speech'],
  },
]

/** Order of top-level sections on the home page. References either a family id or a supergroup id. */
export const HOME_SECTION_ORDER: string[] = [
  'text',
  'live',
  'genmedia',          // supergroup containing image + video + music + speech
  'embeddings',
  'specialized',
]

/**
 * Migration map — explicit "if you're on prior, switch to current". Hand-curated
 * because the right migration target isn't always the closest name match
 * (e.g. 2.5 Flash maps to 3 Flash, not 3.1 Flash anything). Each entry is
 * defensible in a customer call.
 */
export type MigrationStep = {
  from: string                     // model id
  to: string                       // model id
  rationale: string                // one line, technical and concrete
}

export const MIGRATIONS: MigrationStep[] = [
  {
    from: 'gemini-2.5-pro',
    to: 'gemini-3.1-pro-preview',
    rationale:
      'Stronger reasoning at the same input price; output rate is half. Tool-fidelity and structured-output adherence both improved.',
  },
  {
    from: 'gemini-2.5-flash',
    to: 'gemini-3-flash-preview',
    rationale:
      'Same price, lower TTFT, better instruction following on long prompts. Direct drop-in for most workloads.',
  },
  {
    from: 'gemini-2.5-flash-lite',
    to: 'gemini-3.1-flash-lite-preview',
    rationale:
      'Same price tier, sharper extraction and routing accuracy. Migrate when you have a regression suite.',
  },
  {
    from: 'gemini-2.5-flash-image',
    to: 'gemini-3.1-flash-image-preview',
    rationale:
      'Same per-image fee. Sharper detail, better text rendering inside images, fewer artefacts on edits.',
  },
  {
    from: 'gemini-2.5-flash-native-audio-preview-12-2025',
    to: 'gemini-3.1-flash-live-preview',
    rationale:
      'Lower turn-taking latency, better interruption handling. Voice profiles shifted — re-evaluate before flipping prod.',
  },
  {
    from: 'gemini-2.5-pro-preview-tts',
    to: 'gemini-3.1-flash-tts-preview',
    rationale:
      'Cheaper. Comparable single-speaker quality and stronger natural-language style control with inline tags.',
  },
  {
    from: 'gemini-2.5-flash-preview-tts',
    to: 'gemini-3.1-flash-tts-preview',
    rationale:
      'Same price, multi-speaker support, better adherence to inline style tags ([whispers], [excitedly]).',
  },
  {
    from: 'gemini-embedding-001',
    to: 'gemini-embedding-2',
    rationale:
      'Multimodal input (was text-only), higher retrieval quality at the same price. Drop the task_type parameter; fold the task into prompt text instead.',
  },
]

export const TIER_ORDER: ModelTier[] = ['flagship', 'workhorse', 'lite', 'prior', 'preview', 'experimental']

export const TIER_LABEL: Record<ModelTier, string> = {
  flagship: 'flagship',
  workhorse: 'workhorse',
  lite: 'lite',
  prior: 'prior gen',
  preview: 'preview',
  experimental: 'experimental',
}

/**
 * Decision flow — "I want to do X, pick this." Hand-written so the answers
 * read as a senior architect's recommendation, not a feature matrix lookup.
 * Each entry resolves to a real model id in this catalog.
 */
export type DecisionRow = {
  goal: string                     // What the user is trying to do.
  pick: string                     // Model id (matches an entry above).
  add?: string                     // Optional companion feature (sample id) — e.g. "+ context cache".
}

export const DECISIONS: DecisionRow[] = [
  { goal: 'Real-time voice agent, sub-second turn-taking', pick: 'gemini-3.1-flash-live-preview' },
  { goal: 'Default text → text for most workloads', pick: 'gemini-3-flash-preview' },
  { goal: 'Hardest reasoning, multi-step coding, long agentic plans', pick: 'gemini-3.1-pro-preview' },
  { goal: 'Cheapest at scale — routing, classification, extraction', pick: 'gemini-3.1-flash-lite-preview' },
  { goal: 'Tool-using agent (Python functions as tools)', pick: 'gemini-3-flash-preview', add: 'text.tool-call' },
  { goal: 'Multi-turn chat with stateful tool use', pick: 'gemini-3-flash-preview', add: 'text.tool-call-chat' },
  { goal: 'Long-context RAG with a fixed prefix', pick: 'gemini-3-flash-preview', add: 'text.context-cache' },
  { goal: 'Answers grounded in fresh web facts', pick: 'gemini-3-flash-preview', add: 'text.grounding-search' },
  { goal: '"Near me" / location-aware queries', pick: 'gemini-3-flash-preview', add: 'text.grounding-maps' },
  { goal: 'Strict JSON output against a schema', pick: 'gemini-3-flash-preview', add: 'text.structured-output' },
  { goal: 'Hero / 4K image asset for marketing', pick: 'gemini-3-pro-image-preview' },
  { goal: 'Production-batch image generation', pick: 'gemini-3.1-flash-image-preview' },
  { goal: 'Pure text → image, no Gemini reasoning needed', pick: 'imagen-4' },
  { goal: 'Cinematic short video with native audio', pick: 'veo-3.1-generate-preview' },
  { goal: 'Cost-sensitive video iteration', pick: 'veo-3.1-lite-generate-preview' },
  { goal: 'Embeddings for retrieval / RAG / similarity', pick: 'gemini-embedding-2' },
  { goal: 'Browser automation (clicks, forms, navigation)', pick: 'gemini-2.5-computer-use-preview-10-2025' },
  { goal: 'Multi-step agentic deep research', pick: 'deep-research-preview-04-2026' },
]

/**
 * Decision flow chart — branching tree from "what are you building?" to a
 * concrete model recommendation. Five category columns, each with 2-3 leaf
 * models. Rendered as a real flow chart in routes/Home.tsx.
 */
export type FlowLeaf = {
  label: string                    // short use-case description
  model: string                    // canonical model id
  sample?: string                  // optional sample id to jump to
}

export type FlowCategory = {
  id: string
  kicker: string
  label: string
  kids: FlowLeaf[]
}

export const DECISION_FLOW: FlowCategory[] = [
  {
    id: 'voice',
    kicker: 'voice',
    label: 'real-time audio',
    kids: [
      { label: 'voice agent · sub-second turn-taking', model: 'gemini-3.1-flash-live-preview' },
      { label: 'standalone speech', model: 'gemini-3.1-flash-tts-preview' },
    ],
  },
  {
    id: 'text',
    kicker: 'reasoning · agents',
    label: 'text & tools',
    kids: [
      { label: 'default workhorse', model: 'gemini-3-flash-preview', sample: 'text.basic' },
      { label: 'hardest reasoning', model: 'gemini-3.1-pro-preview', sample: 'text.thinking' },
      { label: 'cheapest at scale', model: 'gemini-3.1-flash-lite-preview' },
    ],
  },
  {
    id: 'image',
    kicker: 'pixels',
    label: 'image generation',
    kids: [
      { label: 'hero / 4K studio', model: 'gemini-3-pro-image-preview' },
      { label: 'production batch', model: 'gemini-3.1-flash-image-preview', sample: 'image.nano-banana' },
    ],
  },
  {
    id: 'video',
    kicker: 'frames',
    label: 'video generation',
    kids: [
      { label: 'cinematic + audio', model: 'veo-3.1-generate-preview', sample: 'video.veo' },
      { label: 'cost-sensitive', model: 'veo-3.1-lite-generate-preview' },
    ],
  },
  {
    id: 'embed',
    kicker: 'vectors · agents',
    label: 'embed & specialised',
    kids: [
      { label: 'multimodal embeddings', model: 'gemini-embedding-2', sample: 'embeddings.basic' },
      { label: 'browser automation', model: 'gemini-2.5-computer-use-preview-10-2025' },
    ],
  },
]

/**
 * Capability matrix — a tighter view across the text family. The
 * checkmarks are derived from each model's `capabilities` list, but the
 * column order here is the editorial pick of what matters for a quick scan.
 */
export const CAPABILITY_COLUMNS: { id: string; label: string }[] = [
  { id: 'thinking', label: 'thinking' },
  { id: 'tools', label: 'tools' },
  { id: 'grounding-search', label: 'search' },
  { id: 'grounding-maps', label: 'maps' },
  { id: 'structured-output', label: 'json' },
  { id: 'context-cache', label: 'cache' },
  { id: 'streaming', label: 'stream' },
  { id: 'chat', label: 'chat' },
  { id: 'live-session', label: 'live' },
  { id: 'image-gen', label: 'img-out' },
  { id: 'video-gen', label: 'vid-out' },
]

export function findFamilyForModel(modelId: string): ModelFamily | null {
  for (const fam of FAMILIES) {
    if (fam.models.some((m) => m.id === modelId)) return fam
  }
  return null
}

export function findModelEntry(modelId: string): ModelEntry | null {
  for (const fam of FAMILIES) {
    const m = fam.models.find((m) => m.id === modelId)
    if (m) return m
  }
  return null
}
