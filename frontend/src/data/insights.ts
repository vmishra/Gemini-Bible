/**
 * Empirical, citation-backed data for the home page insight panels.
 *
 * Every record carries `source_url` and `as_of` (YYYY-MM-DD).
 * Numbers are quoted directly from the cited source — no interpolation,
 * no "approximate", no leaderboard-of-the-week.
 *
 * Refresh cadence: pricing quarterly; benchmarks on each Gemini family bump.
 *
 * Primary sources (all accessed 2026-05-01):
 *   - https://ai.google.dev/pricing
 *   - https://ai.google.dev/gemini-api/docs/rate-limits
 *   - https://ai.google.dev/gemini-api/docs/caching
 *   - https://ai.google.dev/gemini-api/docs/tokens
 *   - https://ai.google.dev/gemini-api/docs/prompting-strategies
 *   - https://blog.google/products-and-platforms/products/gemini/gemini-3/
 *   - https://blog.google/products/gemini/gemini-3-flash/
 *   - https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/
 *   - https://deepmind.google/models/model-cards/gemini-3-1-pro/
 *   - https://deepmind.google/models/model-cards/gemini-3-1-flash-lite/
 *   - https://storage.googleapis.com/deepmind-media/Model-Cards/Gemini-3-Flash-Model-Card.pdf
 */

export const ACCESSED = '2026-05-01' as const

// ────────────────────────────────────────────────────────────────────────────
// 1. Master comparison table — Gemini 3 Flash model card (Dec 2025)
// All benchmarks are *Thinking* mode, no tools unless flagged otherwise.

export type BenchmarkRow = {
  benchmark: string                  // canonical benchmark name
  description: string                // one-line gloss
  gemini_3_flash: string | null
  gemini_3_pro: string | null
  gemini_3_1_flash_lite: string | null
  gemini_2_5_flash: string | null
  gemini_2_5_pro: string | null
  claude_sonnet_4_5: string | null
  gpt_5_2: string | null
  grok_4_1_fast: string | null
  higher_is_better: boolean
  group: 'reasoning' | 'coding' | 'multimodal' | 'agentic' | 'multilingual' | 'long-context'
  note?: string
}

export const BENCHMARK_TABLE: BenchmarkRow[] = [
  {
    benchmark: "Humanity's Last Exam",
    description: 'Academic reasoning, full set, text + multimodal',
    gemini_3_flash: '33.7%',
    gemini_3_pro: '37.5%',
    gemini_3_1_flash_lite: '16.0%',
    gemini_2_5_flash: '11.0%',
    gemini_2_5_pro: '21.6%',
    claude_sonnet_4_5: '13.7%',
    gpt_5_2: '34.5%',
    grok_4_1_fast: '17.6%',
    higher_is_better: true,
    group: 'reasoning',
    note: 'No tools',
  },
  {
    benchmark: 'ARC-AGI-2',
    description: 'Visual reasoning puzzles (ARC Prize verified)',
    gemini_3_flash: '33.6%',
    gemini_3_pro: '31.1%',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '2.5%',
    gemini_2_5_pro: '4.9%',
    claude_sonnet_4_5: '13.6%',
    gpt_5_2: '52.9%',
    grok_4_1_fast: null,
    higher_is_better: true,
    group: 'reasoning',
  },
  {
    benchmark: 'GPQA Diamond',
    description: 'Graduate-level scientific knowledge',
    gemini_3_flash: '90.4%',
    gemini_3_pro: '91.9%',
    gemini_3_1_flash_lite: '86.9%',
    gemini_2_5_flash: '82.8%',
    gemini_2_5_pro: '86.4%',
    claude_sonnet_4_5: '83.4%',
    gpt_5_2: '92.4%',
    grok_4_1_fast: '84.3%',
    higher_is_better: true,
    group: 'reasoning',
    note: 'No tools',
  },
  {
    benchmark: 'AIME 2025',
    description: 'High-school competition mathematics',
    gemini_3_flash: '95.2%',
    gemini_3_pro: '95.0%',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '72.0%',
    gemini_2_5_pro: '88.0%',
    claude_sonnet_4_5: '87.0%',
    gpt_5_2: '100%',
    grok_4_1_fast: '91.9%',
    higher_is_better: true,
    group: 'reasoning',
    note: 'No tools',
  },
  {
    benchmark: 'MMMU-Pro',
    description: 'Multimodal understanding and reasoning',
    gemini_3_flash: '81.2%',
    gemini_3_pro: '81.0%',
    gemini_3_1_flash_lite: '76.8%',
    gemini_2_5_flash: '66.7%',
    gemini_2_5_pro: '68.0%',
    claude_sonnet_4_5: '68.0%',
    gpt_5_2: '79.5%',
    grok_4_1_fast: '63.0%',
    higher_is_better: true,
    group: 'multimodal',
  },
  {
    benchmark: 'Video-MMMU',
    description: 'Knowledge acquisition from video',
    gemini_3_flash: '86.9%',
    gemini_3_pro: '87.6%',
    gemini_3_1_flash_lite: '84.8%',
    gemini_2_5_flash: '79.2%',
    gemini_2_5_pro: '83.6%',
    claude_sonnet_4_5: '77.8%',
    gpt_5_2: '85.9%',
    grok_4_1_fast: null,
    higher_is_better: true,
    group: 'multimodal',
  },
  {
    benchmark: 'CharXiv Reasoning',
    description: 'Information synthesis from complex charts',
    gemini_3_flash: '80.3%',
    gemini_3_pro: '81.4%',
    gemini_3_1_flash_lite: '73.2%',
    gemini_2_5_flash: '63.7%',
    gemini_2_5_pro: '69.6%',
    claude_sonnet_4_5: '68.5%',
    gpt_5_2: '82.1%',
    grok_4_1_fast: null,
    higher_is_better: true,
    group: 'multimodal',
  },
  {
    benchmark: 'LiveCodeBench Pro',
    description: 'Competitive coding (Codeforces / ICPC / IOI), Elo',
    gemini_3_flash: '2316',
    gemini_3_pro: '2439',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '1143',
    gemini_2_5_pro: '1775',
    claude_sonnet_4_5: '1418',
    gpt_5_2: '2393',
    grok_4_1_fast: null,
    higher_is_better: true,
    group: 'coding',
    note: 'Elo rating',
  },
  {
    benchmark: 'SWE-bench Verified',
    description: 'Agentic coding on real GitHub issues',
    gemini_3_flash: '78.0%',
    gemini_3_pro: '76.2%',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '60.4%',
    gemini_2_5_pro: '59.6%',
    claude_sonnet_4_5: '77.2%',
    gpt_5_2: '80.0%',
    grok_4_1_fast: '50.6%',
    higher_is_better: true,
    group: 'coding',
    note: 'Single attempt',
  },
  {
    benchmark: 'Terminal-bench 2.0',
    description: 'Agentic terminal coding (Terminus-2 harness)',
    gemini_3_flash: '47.6%',
    gemini_3_pro: '54.2%',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '16.9%',
    gemini_2_5_pro: '32.6%',
    claude_sonnet_4_5: '42.8%',
    gpt_5_2: null,
    grok_4_1_fast: null,
    higher_is_better: true,
    group: 'coding',
  },
  {
    benchmark: 'τ2-bench',
    description: 'Agentic tool use across realistic workflows',
    gemini_3_flash: '90.2%',
    gemini_3_pro: '90.7%',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '79.5%',
    gemini_2_5_pro: '77.8%',
    claude_sonnet_4_5: '87.2%',
    gpt_5_2: null,
    grok_4_1_fast: null,
    higher_is_better: true,
    group: 'agentic',
  },
  {
    benchmark: 'ToolAthlon',
    description: 'Long-horizon real-world software tasks',
    gemini_3_flash: '49.4%',
    gemini_3_pro: '36.4%',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '3.7%',
    gemini_2_5_pro: '10.5%',
    claude_sonnet_4_5: '38.9%',
    gpt_5_2: '46.3%',
    grok_4_1_fast: null,
    higher_is_better: true,
    group: 'agentic',
  },
  {
    benchmark: 'MCP Atlas',
    description: 'Multi-step workflows over MCP tools',
    gemini_3_flash: '57.4%',
    gemini_3_pro: '54.1%',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '3.4%',
    gemini_2_5_pro: '8.8%',
    claude_sonnet_4_5: '43.8%',
    gpt_5_2: '60.6%',
    grok_4_1_fast: null,
    higher_is_better: true,
    group: 'agentic',
  },
  {
    benchmark: 'Vending-Bench 2',
    description: 'Agentic long-term coherence (mean net worth, USD)',
    gemini_3_flash: '$3,635',
    gemini_3_pro: '$5,478',
    gemini_3_1_flash_lite: null,
    gemini_2_5_flash: '$549',
    gemini_2_5_pro: '$574',
    claude_sonnet_4_5: '$3,839',
    gpt_5_2: '$3,952',
    grok_4_1_fast: '$1,107',
    higher_is_better: true,
    group: 'agentic',
  },
  {
    benchmark: 'FACTS Benchmark Suite',
    description: 'Factual grounding, parametric, search, multimodal',
    gemini_3_flash: '61.9%',
    gemini_3_pro: '70.5%',
    gemini_3_1_flash_lite: '40.6%',
    gemini_2_5_flash: '50.4%',
    gemini_2_5_pro: '63.4%',
    claude_sonnet_4_5: '48.9%',
    gpt_5_2: '61.4%',
    grok_4_1_fast: '42.1%',
    higher_is_better: true,
    group: 'reasoning',
  },
  {
    benchmark: 'SimpleQA Verified',
    description: 'Parametric knowledge / hallucination resistance',
    gemini_3_flash: '68.7%',
    gemini_3_pro: '72.1%',
    gemini_3_1_flash_lite: '43.3%',
    gemini_2_5_flash: '28.1%',
    gemini_2_5_pro: '54.5%',
    claude_sonnet_4_5: '29.3%',
    gpt_5_2: '38.0%',
    grok_4_1_fast: '19.5%',
    higher_is_better: true,
    group: 'reasoning',
  },
  {
    benchmark: 'MMMLU',
    description: 'Multilingual Q&A across 100 languages',
    gemini_3_flash: '91.8%',
    gemini_3_pro: '91.8%',
    gemini_3_1_flash_lite: '88.9%',
    gemini_2_5_flash: '86.6%',
    gemini_2_5_pro: '89.5%',
    claude_sonnet_4_5: '89.1%',
    gpt_5_2: '89.6%',
    grok_4_1_fast: '86.8%',
    higher_is_better: true,
    group: 'multilingual',
  },
  {
    benchmark: 'MRCR v2 @ 128k',
    description: '8-needle long-context recall at 128K input',
    gemini_3_flash: '67.2%',
    gemini_3_pro: '77.0%',
    gemini_3_1_flash_lite: '60.1%',
    gemini_2_5_flash: '54.3%',
    gemini_2_5_pro: '58.0%',
    claude_sonnet_4_5: '47.1%',
    gpt_5_2: '81.9%',
    grok_4_1_fast: '54.6%',
    higher_is_better: true,
    group: 'long-context',
  },
  {
    benchmark: 'MRCR v2 @ 1M',
    description: 'Pointwise long-context recall at 1M input',
    gemini_3_flash: '22.1%',
    gemini_3_pro: '26.3%',
    gemini_3_1_flash_lite: '12.3%',
    gemini_2_5_flash: '21.0%',
    gemini_2_5_pro: '16.4%',
    claude_sonnet_4_5: 'n/s',
    gpt_5_2: 'n/s',
    grok_4_1_fast: '6.1%',
    higher_is_better: true,
    group: 'long-context',
    note: 'n/s = not supported',
  },
]

export const BENCHMARK_SOURCE = {
  url: 'https://storage.googleapis.com/deepmind-media/Model-Cards/Gemini-3-Flash-Model-Card.pdf',
  label: 'Gemini 3 Flash Model Card (Google DeepMind, Dec 2025)',
  as_of: ACCESSED,
}

export const FLASH_LITE_SOURCE = {
  url: 'https://deepmind.google/models/model-cards/gemini-3-1-flash-lite/',
  label: 'Gemini 3.1 Flash-Lite Model Card (Google DeepMind, March 2026)',
  as_of: ACCESSED,
}

// ────────────────────────────────────────────────────────────────────────────
// Flash-Lite-in-context — what makes the cheapest 3.x tier worth its own panel.

export type LiteHighlight = {
  metric: string
  value: string
  context: string                  // what it means; how it compares to 3 Flash
}

export const FLASH_LITE_HIGHLIGHTS: LiteHighlight[] = [
  { metric: 'Output speed', value: '363 tok/s', context: 'The only authoritative tok/s number Google publishes for the family.' },
  { metric: 'Input price', value: '$0.25/MTok', context: 'Half the price of 3 Flash ($0.50). Flash-Lite is the unit-cost winner.' },
  { metric: 'GPQA Diamond', value: '86.9%', context: 'vs 90.4% on 3 Flash. Holds graduate-level science at half the price.' },
  { metric: 'MMMU-Pro', value: '76.8%', context: 'vs 81.2% on 3 Flash. Multimodal reasoning stays viable.' },
  { metric: 'Video-MMMU', value: '84.8%', context: 'Within 2 pt of 3 Flash (86.9%). Video understanding barely degrades.' },
  { metric: 'MMMLU (100 languages)', value: '88.9%', context: 'vs 91.8% on 3 Flash. Multilingual coverage holds.' },
  { metric: "Humanity's Last Exam", value: '16.0%', context: 'vs 33.7% on 3 Flash. Deep reasoning is capped — escalate to Flash.' },
  { metric: 'MRCR v2 @ 1M', value: '12.3%', context: 'Crashes hard at 1M depth. Stay under 128K, or use Flash for depth.' },
]

export const FLASH_LITE_NOT_PUBLISHED = [
  'ARC-AGI-2',
  'AIME 2025',
  'ScreenSpot-Pro',
  'OmniDocBench 1.5',
  'LiveCodeBench Pro',
  'Terminal-bench 2.0',
  'SWE-bench Verified',
  'τ2-bench',
  'ToolAthlon',
  'MCP Atlas',
  'Vending-Bench 2',
  'Global PIQA',
] as const

// ────────────────────────────────────────────────────────────────────────────
// 2. Generation jump — 2.5 → 3 highlights

export type JumpRow = {
  benchmark: string
  family: 'flash' | 'pro' | 'flash-lite'
  before: string                     // 2.5 score
  after: string                      // 3 / 3.1 score
  multiple_or_pct: string            // pre-computed "13×" or "+103%"
  note?: string
}

export const GENERATION_JUMPS: JumpRow[] = [
  { benchmark: "Humanity's Last Exam", family: 'flash', before: '11.0%', after: '33.7%', multiple_or_pct: '3.1×' },
  { benchmark: "Humanity's Last Exam", family: 'pro', before: '21.6%', after: '37.5%', multiple_or_pct: '+74%' },
  { benchmark: 'LiveCodeBench Pro (Elo)', family: 'flash', before: '1143', after: '2316', multiple_or_pct: '+103%' },
  { benchmark: 'LiveCodeBench Pro (Elo)', family: 'pro', before: '1775', after: '2439', multiple_or_pct: '+37%' },
  { benchmark: 'SWE-bench Verified', family: 'flash', before: '60.4%', after: '78.0%', multiple_or_pct: '+29%' },
  { benchmark: 'ToolAthlon', family: 'flash', before: '3.7%', after: '49.4%', multiple_or_pct: '13×' },
  { benchmark: 'MCP Atlas', family: 'flash', before: '3.4%', after: '57.4%', multiple_or_pct: '17×' },
  { benchmark: 'Vending-Bench 2 (net worth)', family: 'pro', before: '$574', after: '$5,478', multiple_or_pct: '9.5×' },
  { benchmark: 'AIME 2025 (no tools)', family: 'flash', before: '72.0%', after: '95.2%', multiple_or_pct: '+32%' },
  { benchmark: 'ARC-AGI-2', family: 'flash', before: '2.5%', after: '33.6%', multiple_or_pct: '13×' },
]

// ────────────────────────────────────────────────────────────────────────────
// Type widening: JumpRow.family now also accepts 'flash-lite' so future
// 2.5 Flash-Lite → 3.1 Flash-Lite jumps can be added once Google publishes
// matched benchmarks.

// ────────────────────────────────────────────────────────────────────────────
// 3. "Flash beats Pro" — benchmarks where 3 Flash matches or exceeds 3 Pro

export const FLASH_VS_PRO: { benchmark: string; flash: string; pro: string; delta: string }[] = [
  { benchmark: 'SWE-bench Verified', flash: '78.0%', pro: '76.2%', delta: '+1.8 pt' },
  { benchmark: 'ToolAthlon', flash: '49.4%', pro: '36.4%', delta: '+13.0 pt' },
  { benchmark: 'MCP Atlas', flash: '57.4%', pro: '54.1%', delta: '+3.3 pt' },
  { benchmark: 'MMMU-Pro', flash: '81.2%', pro: '81.0%', delta: '+0.2 pt' },
  { benchmark: 'AIME 2025 (no tools)', flash: '95.2%', pro: '95.0%', delta: '+0.2 pt' },
  { benchmark: 'ARC-AGI-2', flash: '33.6%', pro: '31.1%', delta: '+2.5 pt' },
  { benchmark: 'MMMLU', flash: '91.8%', pro: '91.8%', delta: 'tie' },
]

// ────────────────────────────────────────────────────────────────────────────
// 4. Long-context honesty — 128K vs 1M

export type LongContextRow = { model: string; at_128k: string; at_1m: string }

export const LONG_CONTEXT: LongContextRow[] = [
  { model: 'gemini-3.1-pro-preview', at_128k: '84.9%', at_1m: '26.3%' },
  { model: 'gemini-3-pro-preview', at_128k: '77.0%', at_1m: '26.3%' },
  { model: 'gemini-3-flash-preview', at_128k: '67.2%', at_1m: '22.1%' },
  { model: 'gemini-3.1-flash-lite-preview', at_128k: '60.1%', at_1m: '12.3%' },
  { model: 'gemini-2.5-pro', at_128k: '58.0%', at_1m: '16.4%' },
  { model: 'gemini-2.5-flash', at_128k: '54.3%', at_1m: '21.0%' },
]

// ────────────────────────────────────────────────────────────────────────────
// 5. Modality token costs

export const MODALITY_TOKENS = [
  { modality: 'text', equivalence: '~4 chars per token', headline: '100 tokens ≈ 60–80 English words' },
  { modality: 'image (≤384 px both dims)', equivalence: '258 tokens', headline: 'flat per image' },
  { modality: 'image (larger)', equivalence: '258 tokens / 768×768 tile', headline: 'a 10 MP image ≈ 16 tiles ≈ 4,128 tokens' },
  { modality: 'audio', equivalence: '32 tokens / second', headline: '60 s ≈ 1,920 tokens' },
  { modality: 'video', equivalence: '263 tokens / second', headline: '60 s ≈ 15,780 tokens (8.2× audio)' },
] as const

export const MODALITY_SOURCE = {
  url: 'https://ai.google.dev/gemini-api/docs/tokens',
  label: 'Gemini API — Token counting',
  as_of: ACCESSED,
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Cache break-even — when explicit caching pays off

export type CacheBreakeven = {
  model: string
  prefix_tokens: number
  ttl_hours: number
  no_cache_per_call_usd: number      // input cost per call without cache
  cache_storage_usd: number          // storage fee for the TTL window
  cache_per_call_usd: number         // input cost per call with cache hit
  break_even_calls: number           // ceil(storage / (no_cache - cache))
}

export const CACHE_BREAKEVEN: CacheBreakeven[] = [
  // 30K prefix, 1 hour
  {
    model: 'gemini-3-flash-preview',
    prefix_tokens: 30000,
    ttl_hours: 1,
    no_cache_per_call_usd: 0.015,    // 30K * $0.50/MTok
    cache_storage_usd: 0.030,        // 30K * $1/MTok/hr
    cache_per_call_usd: 0.0015,      // 30K * $0.05/MTok
    break_even_calls: 3,             // 0.030 / (0.015 - 0.0015) = 2.22 → 3
  },
  {
    model: 'gemini-3.1-flash-lite-preview',
    prefix_tokens: 30000,
    ttl_hours: 1,
    no_cache_per_call_usd: 0.0075,   // 30K * $0.25/MTok
    cache_storage_usd: 0.030,        // 30K * $1/MTok/hr
    cache_per_call_usd: 0.00075,     // 30K * $0.025/MTok
    break_even_calls: 5,             // 0.030 / (0.0075 - 0.00075) = 4.44 → 5
  },
  // 100K prefix, 1 hour
  {
    model: 'gemini-3.1-pro-preview',
    prefix_tokens: 100000,
    ttl_hours: 1,
    no_cache_per_call_usd: 0.20,     // 100K * $2/MTok
    cache_storage_usd: 0.45,         // 100K * $4.50/MTok/hr
    cache_per_call_usd: 0.020,       // 100K * $0.20/MTok
    break_even_calls: 3,             // 0.45 / (0.20 - 0.020) = 2.5 → 3
  },
  {
    model: 'gemini-2.5-pro',
    prefix_tokens: 100000,
    ttl_hours: 1,
    no_cache_per_call_usd: 0.125,    // 100K * $1.25/MTok
    cache_storage_usd: 0.45,         // 100K * $4.50/MTok/hr
    cache_per_call_usd: 0.0125,      // 100K * $0.125/MTok
    break_even_calls: 5,             // 0.45 / (0.125 - 0.0125) = 4.0 → 5
  },
]

export const CACHE_SOURCE = {
  url: 'https://ai.google.dev/gemini-api/docs/caching',
  label: 'Gemini API — Context caching',
  as_of: ACCESSED,
}

// ────────────────────────────────────────────────────────────────────────────
// 7. Long-context tier boundary — Pro models double input price above 200K

export const LONG_CONTEXT_TIER = [
  {
    model: 'gemini-3.1-pro-preview',
    boundary_tokens: 200_000,
    input_below: 2.0,
    input_above: 4.0,
    output_below: 12.0,
    output_above: 18.0,
  },
  {
    model: 'gemini-2.5-pro',
    boundary_tokens: 200_000,
    input_below: 1.25,
    input_above: 2.5,
    output_below: 10.0,
    output_above: 15.0,
  },
] as const

// ────────────────────────────────────────────────────────────────────────────
// 8. Migration ROI — grounding fee drop, family generation jumps

export const GROUNDING_MIGRATION = {
  before: { family: '2.5', search: 35, maps: 25, free_search_rpd: 1500, free_maps_rpd: 10000 },
  after: { family: '3.x', search: 14, maps: 14, free_per_month: 5000 },
  savings_pct_search: 60,
  savings_pct_maps: 44,
} as const

// ────────────────────────────────────────────────────────────────────────────
// 9. Best-practice callouts (Gemini 3.x)

export type BestPractice = { title: string; rule: string; reason: string }

export const BEST_PRACTICES: BestPractice[] = [
  {
    title: 'Default temperature 1.0',
    rule: 'Keep temperature at 1.0 for Gemini 3.x.',
    reason:
      'The model is calibrated for T=1.0. Forcing T=0 for "determinism" hurts reasoning and tool-call accuracy on this family.',
  },
  {
    title: 'Be terse, not persuasive',
    rule: 'State the goal concisely. Skip motivating language.',
    reason:
      'Gemini 3 is direct and efficient by default. Flowery prompts dilute signal — "you are an expert who…" no longer earns its tokens.',
  },
  {
    title: 'Context first, instruction last',
    rule: 'On long prompts, place the documents first and the question at the very end.',
    reason:
      'Recency bias is real. Putting the instruction last keeps it fresh in the attention window after a 100k-token document.',
  },
  {
    title: 'Few-shot is non-optional',
    rule: 'Include few-shot examples in every non-trivial prompt.',
    reason:
      'Even with strong zero-shot capability, examples narrow output format and tone. Especially load-bearing for structured output and tool selection.',
  },
  {
    title: 'Code execution beats arithmetic in-prompt',
    rule: 'Enable the code-execution tool whenever the answer involves arithmetic.',
    reason:
      'Letting the model run Python is more reliable than letting it reason its way to a number — even at the frontier.',
  },
]

export const BEST_PRACTICES_SOURCE = {
  url: 'https://ai.google.dev/gemini-api/docs/prompting-strategies',
  label: 'Gemini API — Prompting strategies',
  as_of: ACCESSED,
}

// ────────────────────────────────────────────────────────────────────────────
// 10. Highlight pull-quotes for callouts

export const PULL_QUOTES = {
  flash_throughput: {
    text: '> 1 trillion tokens / day on the API',
    source: 'https://blog.google/products/gemini/gemini-3-flash/',
    label: 'Gemini 3 Flash blog (Dec 2025)',
    context: 'Public throughput claim — gives a sense of the workload tier the API is built for.',
  },
  flash_vs_pro_speed: {
    text: '3× faster than Gemini 2.5 Pro',
    source: 'https://blog.google/products/gemini/gemini-3-flash/',
    label: 'Gemini 3 Flash blog (Dec 2025)',
    context: 'Per Artificial Analysis benchmarking, cited in the Flash launch post.',
  },
  flash_token_efficiency: {
    text: '30% fewer tokens than 2.5 Pro on typical traffic',
    source: 'https://blog.google/products/gemini/gemini-3-flash/',
    label: 'Gemini 3 Flash blog (Dec 2025)',
    context: 'Same benchmark; affects the raw cost story even before unit price.',
  },
  flash_lite_speed: {
    text: '363 tokens / second output speed',
    source: 'https://deepmind.google/models/model-cards/gemini-3-1-flash-lite/',
    label: 'Gemini 3.1 Flash-Lite model card',
    context: 'The only authoritative tok/s number Google publishes for this family.',
  },
  pro_arc_jump: {
    text: 'Gemini 3.1 Pro on ARC-AGI-2: 77.1% — "more than double" Gemini 3 Pro',
    source: 'https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/',
    label: 'Gemini 3.1 Pro launch (Feb 2026)',
    context: 'Headline reasoning improvement between 3 → 3.1 generation.',
  },
} as const
