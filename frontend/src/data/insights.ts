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
// Domain best-practices for the dedicated /practices page.
// Each rule is paraphrased tightly with the official quote (where pulled
// verbatim) and a citation. Refresh the URL list quarterly.

export type PracticeRule = {
  title: string
  rule: string                       // the imperative
  why: string                        // why it matters
  source: string                     // URL to the cited official page
}

export type PracticeSection = {
  id: string
  label: string
  kicker: string
  blurb: string
  primary_source_url: string
  primary_source_label: string
  rules: PracticeRule[]
}

export const PRACTICE_SECTIONS: PracticeSection[] = [
  {
    id: 'prompting',
    label: 'Prompting · Gemini 3.x',
    kicker: 'precision over persuasion',
    blurb:
      "Quoted from the Gemini 3 Developer Guide. Each rule contradicts a heuristic that worked on 2.x — Gemini 3's reasoning model over-analyzes the prompt-engineering tricks that earlier models needed.",
    primary_source_url: 'https://ai.google.dev/gemini-api/docs/gemini-3#prompting_best_practices',
    primary_source_label: 'Gemini 3 Developer Guide — Prompting best practices',
    rules: [
      {
        title: 'Be precise, not elaborate',
        rule: 'Be concise in your input prompts. Direct, clear instructions only.',
        why: '"Verbose or overly complex prompt engineering" makes Gemini 3 over-analyze. Old 2.x prompt-engineering tricks now cost quality.',
        source: 'https://ai.google.dev/gemini-api/docs/gemini-3#prompting_best_practices',
      },
      {
        title: 'Default temperature 1.0',
        rule: 'Keep temperature at the default value of 1.0.',
        why: 'Gemini 3 is calibrated for T=1.0; "changing it may cause performance degradation". Forcing T=0 for "determinism" hurts reasoning and tool selection.',
        source: 'https://ai.google.dev/gemini-api/docs/gemini-3#prompting_best_practices',
      },
      {
        title: 'Verbosity is opt-in',
        rule: "Default Gemini 3 is terse. Ask explicitly for conversational output if that's what you want.",
        why: '"By default, Gemini 3 is less verbose and prefers providing direct, efficient answers." Existing prompts that expected chatty output will read as curt without this prefix.',
        source: 'https://ai.google.dev/gemini-api/docs/gemini-3#prompting_best_practices',
      },
      {
        title: 'Context first, instruction last',
        rule: 'On long prompts (book / codebase / long video), put the data first and the question at the end.',
        why: '"When working with large datasets… place your specific instructions or questions at the end of the prompt." Anchor with phrases like "Based on the information above…".',
        source: 'https://ai.google.dev/gemini-api/docs/gemini-3#prompting_best_practices',
      },
      {
        title: 'Tune thinking_level explicitly',
        rule: 'Set thinking_level on every 3.x call. Default is "high" — the most expensive setting.',
        why: 'Thinking tokens bill at the output rate. "minimal" / "low" cap the reasoning budget on Flash; reach for "high" on hard reasoning tasks only.',
        source: 'https://ai.google.dev/gemini-api/docs/thinking',
      },
      {
        title: 'Use the built-in tools',
        rule: 'Enable Google Search for fresh facts; Code Execution for any arithmetic; URL Context for citing a specific page.',
        why: 'Letting the model run Python beats letting it reason its way to a number, even at the frontier. Search-grounded answers carry citations.',
        source: 'https://ai.google.dev/gemini-api/docs/gemini-3#prompting_best_practices',
      },
    ],
  },
  {
    id: 'image-generation',
    label: 'Image generation · Nano Banana',
    kicker: 'pixels',
    blurb:
      "Quoted from Vertex AI's Gemini image-generation guide. Aimed at the Nano Banana family (gemini-3-pro-image-preview, gemini-3.1-flash-image-preview, gemini-2.5-flash-image).",
    primary_source_url:
      'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-best-practices',
    primary_source_label: 'Vertex AI — Gemini image generation best practices',
    rules: [
      {
        title: 'Describe what you want, not what you don\'t',
        rule: 'Lead with positive description. Banned-elements lists confuse the model more than they help.',
        why: 'Negation is hard for diffusion-style generation; the named element gets attended to anyway. Spend tokens on the desired outcome.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-best-practices',
      },
      {
        title: 'Be specific — every detail buys control',
        rule: '"More details give you more control." Subject, lighting, mood, lens, composition, style.',
        why: 'Sparse prompts get sparse images. Reference photographic terms ("85mm portrait", "golden hour", "shallow depth of field") for predictable results.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-best-practices',
      },
      {
        title: 'State the intent',
        rule: 'Tell the model the use case — "generate an image of…", "for a marketing landing page", "magazine cover style".',
        why: '"Explain the purpose of the image to help the model understand." Intent is a strong steering signal that\'s cheap to add.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-best-practices',
      },
      {
        title: 'Step-by-step for complex scenes',
        rule: 'Split a complex composition into ordered instructions ("first…", "then…", "finally…").',
        why: '"For complex scenes, split your request into steps." A serial prompt orders the model\'s attention; one giant paragraph competes against itself.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-best-practices',
      },
      {
        title: 'Iterate — first shot is rarely the keeper',
        rule: '"Don\'t expect a perfect image on your first attempt." Generate, critique, edit, regenerate.',
        why: 'Images are a search problem; the prompt is one move. Plan two or three rounds into the workflow.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-best-practices',
      },
      {
        title: 'Pass thought signatures on multi-turn',
        rule: 'On Gemini 3 Pro Image, pass thought signatures back to the model across turns when iterating on the same image.',
        why: '"When using Gemini 3 Pro Image, we recommend that you pass thought signatures back to the model during multi-turn image creation." Preserves the model\'s plan from one edit to the next.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-best-practices',
      },
      {
        title: 'Direct the camera explicitly',
        rule: 'Use cinematic and photographic vocabulary — "wide-angle establishing shot", "macro", "rim light", "dutch angle".',
        why: 'The model has been trained on labeled imagery; named camera moves resolve to consistent visual choices.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/gemini-image-generation-best-practices',
      },
    ],
  },
  {
    id: 'live-api',
    label: 'Live API · realtime audio + video',
    kicker: 'session lifecycle',
    blurb:
      'Combined from the AI Studio and Vertex AI Live API best-practices pages. Covers session management, audio handling, interruption, and the system-instruction contract for voice agents.',
    primary_source_url: 'https://ai.google.dev/gemini-api/docs/live-api/best-practices',
    primary_source_label: 'Gemini API — Live API best practices',
    rules: [
      {
        title: 'Compress the context window',
        rule: 'Set ContextWindowCompressionConfig on long sessions.',
        why: 'Audio tokens accumulate at "approximately 25 tokens per second of audio". Without compression, sessions cap at 15 minutes audio-only / 2 minutes audio-video.',
        source: 'https://ai.google.dev/gemini-api/docs/live-api/best-practices',
      },
      {
        title: 'Implement session resumption',
        rule: 'Cache the resumption token; reconnect with it after WebSocket drops.',
        why: '"The server may periodically reset the WebSocket connection." Resumption tokens stay valid for 2 hours after termination.',
        source: 'https://ai.google.dev/gemini-api/docs/live-api/best-practices',
      },
      {
        title: 'Listen for GoAway and reconnect gracefully',
        rule: 'On a GoAway message, use the `timeLeft` field to wrap up cleanly before reconnecting.',
        why: 'Server signals impending disconnect ahead of time; ignoring it means a hard cut mid-utterance.',
        source: 'https://ai.google.dev/gemini-api/docs/live-api/best-practices',
      },
      {
        title: 'Resample mic input to 16 kHz before sending',
        rule: 'Client must resample microphone audio (typically 44.1 / 48 kHz) down to 16 kHz before transmit.',
        why: '"Ensure your client application resamples microphone input… to 16 kHz before transmission." The API does not resample for you.',
        source: 'https://ai.google.dev/gemini-api/docs/live-api/best-practices',
      },
      {
        title: 'Send audio in 20–40 ms chunks',
        rule: 'Send small frames (20–40 ms, up to 100 ms). Don\'t buffer 1-second chunks.',
        why: '"Don\'t buffer input audio significantly… Send small chunks to minimize latency." Coarse buffering destroys the perceived responsiveness of voice.',
        source: 'https://ai.google.dev/gemini-api/docs/live-api/best-practices',
      },
      {
        title: 'Discard your output buffer on interruption',
        rule: 'When a server_content arrives with `interrupted: true`, immediately drop the client-side audio buffer for the in-flight reply.',
        why: 'The user spoke over the model. Continuing to play the buffered reply is the most jarring failure mode of voice UX.',
        source: 'https://ai.google.dev/gemini-api/docs/live-api/best-practices',
      },
      {
        title: 'System instruction order matters',
        rule: 'Order: agent persona → conversational rules → guardrails. Set language explicitly.',
        why: 'Vertex page: "Without this definition, Gemini might alter the conversation language depending on the provided context." Add a final-line guardrail like "RESPOND IN {LANG}."',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/best-practices',
      },
      {
        title: 'Be specific in tool definitions',
        rule: 'In your tool definitions, tell Gemini under what conditions to invoke each tool. Show counter-examples in the prompt.',
        why: 'Vertex Live page: tool selection in voice is harder than in text — fewer signal tokens — so explicit guardrails earn their keep.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/best-practices',
      },
      {
        title: 'Custom VAD — disable the default first',
        rule: 'If you implement custom voice-activity detection, disable the default VAD and signal turns via ActivityStart / ActivityEnd events.',
        why: 'Two simultaneous VADs fight; you get duplicate turn-taking and missed interruptions. Pick one.',
        source:
          'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/live-api/best-practices',
      },
    ],
  },
  {
    id: 'chat',
    label: 'Multi-turn chat · Interactions API',
    kicker: 'state management',
    blurb:
      "Most engineers reach for client.models.generate_content and rebuild history manually. The Interactions API ('chat' surface) is the stateful alternative — the server holds context, you pass an id. Capture the contract before customers hit the differences in production.",
    primary_source_url: 'https://ai.google.dev/gemini-api/docs/interactions?ua=chat',
    primary_source_label: 'Gemini API — Interactions',
    rules: [
      {
        title: 'Stateful: pass `previous_interaction_id`',
        rule: 'For multi-turn flows, pass the previous turn\'s `id` as `previous_interaction_id`. The server inherits prior context — system instruction, tools, history — automatically.',
        why: 'No manual history-rebuilding per turn. Cleaner client code, fewer copy-the-history-array bugs.',
        source: 'https://ai.google.dev/gemini-api/docs/interactions?ua=chat',
      },
      {
        title: 'Stateless alternative: client-side history',
        rule: 'If you can\'t hold an `id` (stateless backend, multi-region failover), maintain a `conversation_history` array of role/content turns and resend it each call.',
        why: '"You can manage conversation history manually on the client side." The trade is your code holds state instead of the API.',
        source: 'https://ai.google.dev/gemini-api/docs/interactions?ua=chat',
      },
      {
        title: 'Function-result shape',
        rule: 'A `function_result.result` must be one of: an object, a stringified value, or a list of content objects. Never a raw arbitrary list.',
        why: 'Loose shapes round-trip silently and corrupt downstream tool calls. The API enforces these three forms.',
        source: 'https://ai.google.dev/gemini-api/docs/interactions?ua=chat',
      },
      {
        title: 'Inherited fields: don\'t resend',
        rule: 'When using `previous_interaction_id`, system instructions and tool config are inherited. Only resend if you intend to change them mid-conversation.',
        why: 'Repeating them is harmless but wasteful — and re-specifying tools mid-conversation can cause the model to renegotiate plans.',
        source: 'https://ai.google.dev/gemini-api/docs/interactions?ua=chat',
      },
    ],
  },
]

// ────────────────────────────────────────────────────────────────────────────
// Interactions API vs generate_content — explicit comparison

export type ApiCompareRow = {
  axis: string                       // what we're comparing on
  generate_content: string
  interactions: string
  takeaway?: string
}

export const INTERACTIONS_VS_GENERATE: ApiCompareRow[] = [
  {
    axis: 'State',
    generate_content: 'Stateless. Each call carries the full request (system instruction, tools, history).',
    interactions: 'Stateful. Server holds the conversation; client passes `previous_interaction_id`.',
    takeaway: 'Use Interactions when you control the full UX loop; use generate_content when you fan out across regions or need full client control.',
  },
  {
    axis: 'History',
    generate_content: 'Client builds and resends a full `contents` array of role/parts each turn.',
    interactions: 'History is inherited from the previous interaction id automatically.',
  },
  {
    axis: 'System instruction',
    generate_content: 'Re-specify on every call (or on chats.create config).',
    interactions: 'Inherited via previous_interaction_id; re-specify only to change.',
  },
  {
    axis: 'Tools / function calling',
    generate_content: 'Tools list passed on every call; function_call replies returned as response parts.',
    interactions: 'Tools inherited; function results posted back as `function_result` with shape: object | string | list of content.',
  },
  {
    axis: 'Streaming',
    generate_content: 'generate_content_stream — token-by-token chunks, usage_metadata on the final chunk.',
    interactions: 'Streaming supported per-interaction; consult the interactions doc for the chunk shape.',
  },
  {
    axis: 'Best fit',
    generate_content: 'Single-shot calls, RAG pipelines, batch jobs, anything where you re-build context per call.',
    interactions: 'Agent loops, multi-turn chat with persistent tools, anywhere you want server-side context preservation.',
  },
  {
    axis: 'Failure mode',
    generate_content: 'Easy to drop history → context loss; easy to mismatch tool list → silent regressions.',
    interactions: 'Easy to lose the interaction id (no recovery without it); harder to migrate across regions without manual replay.',
  },
]

export const INTERACTIONS_SOURCE = {
  url: 'https://ai.google.dev/gemini-api/docs/interactions?ua=chat',
  label: 'Gemini API — Interactions',
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
