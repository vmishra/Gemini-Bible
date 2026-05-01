import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'
import {
  CAPABILITY_COLUMNS,
  DECISIONS,
  DECISION_FLOW,
  FAMILIES,
  HOME_SECTION_ORDER,
  MIGRATIONS,
  SUPERGROUPS,
  TIER_LABEL,
  TIER_ORDER,
  findModelEntry,
  type FlowCategory,
  type FlowLeaf,
  type ModelEntry,
  type ModelFamily,
  type ModelTier,
  type Supergroup,
} from '../data/catalog'
import { Slide, SlideShell, useInScrollRoot } from '../ui/Slides'
import { cn } from '../ui/cn'
import {
  ACCESSED,
  BENCHMARK_TABLE,
  BENCHMARK_SOURCE,
  CACHE_BREAKEVEN,
  CACHE_SOURCE,
  FLASH_LITE_HIGHLIGHTS,
  FLASH_LITE_NOT_PUBLISHED,
  FLASH_LITE_SOURCE,
  FLASH_VS_PRO,
  GENERATION_JUMPS,
  GROUNDING_MIGRATION,
  LONG_CONTEXT,
  LONG_CONTEXT_TIER,
  MODALITY_TOKENS,
  MODALITY_SOURCE,
  PULL_QUOTES,
  type BenchmarkRow,
} from '../data/insights'
import { useSamples, type Sample } from '../state/samples'
import { useRoute } from '../state/route'
import { usePricing, rateFor } from '../state/pricing'
import { Chip } from '../ui/components/Chip'
import { Panel } from '../ui/components/Panel'

export function Home() {
  const samples = useSamples((s) => s.samples)

  // Map model id → list of samples that support it.
  const samplesByModel = useMemo(() => {
    const out = new Map<string, Sample[]>()
    for (const s of samples) {
      for (const m of s.models) {
        const list = out.get(m) ?? []
        list.push(s)
        out.set(m, list)
      }
    }
    return out
  }, [samples])

  const familyNodes = renderSections(samplesByModel)

  return (
    <SlideShell>
      <Slide id="hero" name="Built on Google × Gemini" className="justify-center">
        <BuiltOnLockup />
        <span
          className="mt-10 block font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          the family
        </span>
        <h1 className="mt-3 font-display text-[56px] leading-[1.02]" style={{ fontWeight: 500 }}>
          The Gemini lineup, the way you actually pick a model.
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[var(--text-muted)]">
          Models, prices, benchmarks. Sourced from the Gemini docs and the
          DeepMind model cards, every number cited.{' '}
          <span className="numeric font-mono text-[14px] text-[var(--text-subtle)]">
            Snapshot {ACCESSED}.
          </span>
        </p>
        <div
          aria-hidden
          className="mt-10 h-px w-60"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--accent-hairline) 20%, var(--accent-hairline) 80%, transparent)',
          }}
        />
      </Slide>

      <Slide id="decision-chart" name="Decision · flow chart">
        <DecisionChartPanel samples={samples} />
      </Slide>

      <Slide id="decision" name="Decision · full list">
        <DecisionTablePanel samples={samples} />
      </Slide>

      <Slide id="generation-jump" name="2.5 → 3 jump">
        <GenerationJumpPanel />
      </Slide>

      <Slide id="flash-vs-pro" name="Flash vs Pro">
        <FlashVsProPanel />
      </Slide>

      <Slide id="flash-lite" name="Flash-Lite in context">
        <FlashLitePanel />
      </Slide>

      <Slide id="frontier-reasoning" name="Frontier · reasoning + multimodal">
        <FrontierComparison
          groups={['reasoning', 'multimodal']}
          partLabel="reasoning + multimodal"
        />
      </Slide>

      <Slide id="frontier-agentic" name="Frontier · coding + agentic + long-context">
        <FrontierComparison
          groups={['coding', 'agentic', 'multilingual', 'long-context']}
          partLabel="coding + agentic + long-context"
        />
      </Slide>

      <Slide id="family-tree" name="Family tree">
        <FamilyTree />
      </Slide>

      {familyNodes.map((node, i) => (
        <Slide key={`family-${i}`} id={`family-${i}`} name={`Family ${i + 1}`}>
          {node}
        </Slide>
      ))}

      <Slide id="capabilities" name="Capability matrix">
        <CapabilityMatrix />
      </Slide>

      <Slide id="modalities" name="Modality matrix">
        <ModalityMatrix />
      </Slide>

      <Slide id="long-context" name="Long-context reality check">
        <LongContextHonesty />
      </Slide>

      <Slide id="cost-ladder" name="Cost ladder">
        <CostLadder />
      </Slide>

      <Slide id="modality-tokens" name="Modality token math">
        <ModalityTokenCosts />
      </Slide>

      <Slide id="cache-breakeven" name="Cache break-even">
        <CacheBreakeven />
      </Slide>

      <Slide id="tier-200k" name="200K tier boundary">
        <LongContextTierPanel />
      </Slide>

      <Slide id="grounding-migration" name="Grounding migration ROI">
        <GroundingMigration />
      </Slide>

      <Slide id="migration-ladder" name="Migration ladder">
        <MigrationLadder />
      </Slide>

      <Slide id="colophon" name="Sources & trademarks" full={false}>
        <footer className="border-t border-[var(--border)] pt-8">
          <p className="text-[13px] leading-relaxed text-[var(--text-subtle)]">
            Models, tiers, and copy edited by hand against the official docs at{' '}
            <a
              href="https://ai.google.dev/gemini-api/docs/models"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
            >
              ai.google.dev/gemini-api/docs/models
            </a>{' '}
            and{' '}
            <a
              href="https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
            >
              cloud.google.com/vertex-ai/generative-ai/docs/learn/models
            </a>
            . Refresh quarterly.
          </p>
          <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-[var(--text-subtle)]">
            Google, the Google logo, Gemini, and the Gemini mark are trademarks
            of Google LLC. Gemini Bible is an independent reference and is not
            affiliated with, endorsed by, or sponsored by Google.
          </p>
        </footer>
      </Slide>
    </SlideShell>
  )
}

function renderSections(samplesByModel: Map<string, Sample[]>) {
  const supergroupById = new Map(SUPERGROUPS.map((sg) => [sg.id, sg]))
  const familyById = new Map(FAMILIES.map((f) => [f.id, f]))
  const familiesInSupergroup = new Set(SUPERGROUPS.flatMap((sg) => sg.family_ids))

  const order =
    HOME_SECTION_ORDER.length > 0
      ? HOME_SECTION_ORDER
      : [
          ...SUPERGROUPS.map((sg) => sg.id),
          ...FAMILIES.filter((f) => !familiesInSupergroup.has(f.id)).map((f) => f.id),
        ]

  const nodes: React.ReactNode[] = []
  for (const id of order) {
    const sg = supergroupById.get(id)
    if (sg) {
      nodes.push(
        <SupergroupBlock key={`sg:${sg.id}`} group={sg} samplesByModel={samplesByModel} />,
      )
      continue
    }
    const family = familyById.get(id)
    if (family && !familiesInSupergroup.has(family.id)) {
      nodes.push(
        <FamilyBlock key={`fam:${family.id}`} family={family} samplesByModel={samplesByModel} />,
      )
    }
  }
  // Fallback: render any family not listed in HOME_SECTION_ORDER and not in a supergroup.
  const handled = new Set(order)
  for (const f of FAMILIES) {
    if (!handled.has(f.id) && !familiesInSupergroup.has(f.id)) {
      nodes.push(
        <FamilyBlock key={`fam:${f.id}`} family={f} samplesByModel={samplesByModel} />,
      )
    }
  }
  return nodes
}

function SupergroupBlock({
  group,
  samplesByModel,
}: {
  group: Supergroup
  samplesByModel: Map<string, Sample[]>
}) {
  const families = useMemo(() => {
    const byId = new Map(FAMILIES.map((f) => [f.id, f]))
    return group.family_ids.map((fid) => byId.get(fid)).filter((f): f is ModelFamily => !!f)
  }, [group.family_ids])

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-[var(--accent-hairline)] pb-5">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--accent)]"
            style={{ letterSpacing: '0.36em' }}
          >
            {group.kicker}
          </span>
          <span className="numeric font-mono text-[10.5px] text-[var(--text-subtle)]">
            {families.reduce((n, f) => n + f.models.length, 0)}
          </span>
        </div>
        <h2 className="font-display text-[32px] leading-[1.05]" style={{ fontWeight: 500 }}>
          {group.label}
        </h2>
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-[var(--text-muted)]">
          {group.blurb}
        </p>
      </header>
      <div className="flex flex-col gap-10 pl-1">
        {families.map((family) => (
          <FamilyBlock
            key={family.id}
            family={family}
            samplesByModel={samplesByModel}
            inSupergroup
          />
        ))}
      </div>
    </section>
  )
}

function BuiltOnLockup() {
  return (
    <div className="flex items-center gap-3">
      <span
        className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.36em' }}
      >
        built on
      </span>
      <span aria-hidden className="h-3 w-px bg-[var(--border)]" />
      <a
        href="https://about.google"
        target="_blank"
        rel="noreferrer"
        className="block transition-opacity hover:opacity-80"
        aria-label="Google"
      >
        <img
          src="/brand/google-wordmark.png"
          alt="Google"
          className="h-[18px] w-auto select-none"
          draggable={false}
        />
      </a>
      <span aria-hidden className="text-[var(--text-subtle)]">×</span>
      <a
        href="https://ai.google.dev/gemini-api/docs"
        target="_blank"
        rel="noreferrer"
        className="block transition-opacity hover:opacity-80"
        aria-label="Gemini API"
      >
        <img
          src="/brand/gemini-wordmark.png"
          alt="Gemini"
          className="h-[20px] w-auto select-none"
          draggable={false}
        />
      </a>
    </div>
  )
}

function FamilyBlock({
  family,
  samplesByModel,
  inSupergroup,
}: {
  family: ModelFamily
  samplesByModel: Map<string, Sample[]>
  inSupergroup?: boolean
}) {
  const sortedModels = useMemo(() => {
    const order = (m: ModelEntry) => TIER_ORDER.indexOf(m.tier)
    return [...family.models].sort((a, b) => order(a) - order(b))
  }, [family.models])

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.36em' }}
          >
            {family.kicker}
          </span>
          <span className="numeric font-mono text-[10.5px] text-[var(--text-subtle)]">
            {family.models.length}
          </span>
        </div>
        <h2
          className={
            inSupergroup
              ? 'text-[20px] font-medium leading-tight tracking-tight'
              : 'text-[26px] font-medium leading-tight tracking-tight'
          }
        >
          {family.label}
        </h2>
        <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--text-muted)]">
          {family.blurb}
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {sortedModels.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            samples={samplesByModel.get(model.id) ?? []}
          />
        ))}
      </div>
    </section>
  )
}

function ModelCard({ model, samples }: { model: ModelEntry; samples: Sample[] }) {
  const pricing = usePricing((s) => s.data)
  const rate = rateFor(pricing, model.id)
  const go = useRoute((s) => s.go)
  const select = useSamples((s) => s.select)

  const openSamples = async () => {
    if (samples[0]) await select(samples[0].id)
    go('samples')
  }

  return (
    <Panel pad={false} className="flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-medium leading-tight">{model.display}</span>
            <TierBadge tier={model.tier} />
          </div>
          <code className="font-mono text-[11px] text-[var(--text-subtle)]">{model.id}</code>
        </div>
        {model.context_window && (
          <span className="numeric shrink-0 font-mono text-[10.5px] text-[var(--text-subtle)]">
            {model.context_window}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4">
        <p className="text-[13px] leading-relaxed text-[var(--text)]">{model.when_to_use}</p>

        <div className="flex flex-col gap-1.5">
          <ModalityRow label="in" items={model.modalities.input} />
          <ModalityRow label="out" items={model.modalities.output} />
        </div>

        {model.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {model.capabilities.map((c) => (
              <Chip key={c} tone="trace">
                {c}
              </Chip>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
        <div className="flex items-baseline gap-3">
          {rate ? (
            <>
              <PriceFragment label="in" value={rate.input_per_mtok_usd} />
              <PriceFragment label="out" value={rate.output_per_mtok_usd} />
              {rate.asset_note && (
                <span className="text-[10.5px] text-[var(--text-subtle)]">{rate.asset_note}</span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-[var(--text-subtle)]">no rate-card row</span>
          )}
        </div>
        <button
          type="button"
          onClick={openSamples}
          disabled={samples.length === 0}
          className="group flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {samples.length > 0
            ? `${samples.length} sample${samples.length === 1 ? '' : 's'}`
            : 'no samples yet'}
          {samples.length > 0 && (
            <ArrowUpRight
              size={12}
              strokeWidth={1.5}
              className="transition-transform group-hover:translate-x-[1px] group-hover:-translate-y-[1px]"
            />
          )}
        </button>
      </div>
    </Panel>
  )
}

function TierBadge({ tier }: { tier: ModelTier }) {
  const tone =
    tier === 'flagship'
      ? 'accent'
      : tier === 'workhorse'
        ? 'trace'
        : tier === 'lite'
          ? 'trace'
          : 'neutral'
  return (
    <Chip tone={tone}>
      <span style={{ letterSpacing: '0.18em' }} className="uppercase">
        {TIER_LABEL[tier]}
      </span>
    </Chip>
  )
}

function ModalityRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="font-mono text-[10px] uppercase text-[var(--text-subtle)] w-6"
        style={{ letterSpacing: '0.18em' }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map((m) => (
          <span
            key={m}
            className="font-mono text-[10.5px] uppercase text-[var(--text-muted)]"
            style={{ letterSpacing: '0.16em' }}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Family tree — ASCII-style hierarchy with prices on the leaves. Built from
// the catalog data so it can't drift from the rest of the page.

type TreeNode = {
  label: string
  detail?: string
  children?: TreeNode[]
  modelId?: string                 // leaf nodes carry a model id for pricing lookup
}

function buildFamilyTree(): TreeNode {
  const familyById = new Map(FAMILIES.map((f) => [f.id, f]))
  const familiesInSg = new Set(SUPERGROUPS.flatMap((sg) => sg.family_ids))

  const familyNode = (f: ModelFamily): TreeNode => ({
    label: f.label,
    detail: f.kicker,
    children: f.models.map((m) => ({
      label: m.display,
      detail: TIER_LABEL[m.tier],
      modelId: m.id,
    })),
  })

  const supergroupNode = (sg: Supergroup): TreeNode => ({
    label: sg.label,
    detail: sg.kicker,
    children: sg.family_ids
      .map((fid) => familyById.get(fid))
      .filter((f): f is ModelFamily => !!f)
      .map(familyNode),
  })

  const sgById = new Map(SUPERGROUPS.map((sg) => [sg.id, sg]))
  const orderedChildren: TreeNode[] = []
  for (const id of HOME_SECTION_ORDER) {
    const sg = sgById.get(id)
    if (sg) {
      orderedChildren.push(supergroupNode(sg))
      continue
    }
    const f = familyById.get(id)
    if (f && !familiesInSg.has(f.id)) orderedChildren.push(familyNode(f))
  }

  return {
    label: 'Gemini',
    detail: 'Google’s generative AI family',
    children: orderedChildren,
  }
}

function FamilyTree() {
  const pricing = usePricing((s) => s.data)
  const root = useMemo(() => buildFamilyTree(), [])

  const lines = useMemo(() => renderTree(root, pricing), [root, pricing])

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          family tree
        </span>
        <h2 className="text-[26px] font-medium leading-tight tracking-tight">
          The lineage in one screen
        </h2>
        <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--text-muted)]">
          Every model under a single root, organized as you'd draw it on a
          whiteboard. Tier on the right; per-MTok input price where the model
          is token-billed.
        </p>
      </div>
      <Panel pad={false} className="overflow-hidden">
        <pre className="overflow-x-auto px-6 py-5 font-mono text-[12.5px] leading-[1.6] text-[var(--text)]">
          {lines.map((line, i) => (
            <div key={i} className="flex justify-between gap-8 whitespace-pre">
              <span className="shrink-0">
                <span className="text-[var(--text-subtle)]">{line.prefix}</span>
                <span className="text-[var(--text)]">{line.label}</span>
                {line.detail && (
                  <span className="ml-3 text-[var(--text-subtle)]">{line.detail}</span>
                )}
              </span>
              {line.price && (
                <span className="numeric shrink-0 text-[var(--text-muted)]">{line.price}</span>
              )}
            </div>
          ))}
        </pre>
      </Panel>
    </section>
  )
}

type RenderedLine = { prefix: string; label: string; detail?: string; price?: string }

function renderTree(
  node: TreeNode,
  pricing: ReturnType<typeof usePricing.getState>['data'],
  prefix = '',
  isLast = true,
  isRoot = true,
): RenderedLine[] {
  const lines: RenderedLine[] = []
  const own = isRoot ? '' : prefix + (isLast ? '└── ' : '├── ')

  let price: string | undefined
  if (node.modelId && pricing) {
    let best = ''
    for (const id of Object.keys(pricing.rate_card)) {
      if (node.modelId.startsWith(id) && id.length > best.length) best = id
    }
    if (best) {
      const r = pricing.rate_card[best]
      price = `$${r.input_per_mtok_usd.toFixed(2)} / $${r.output_per_mtok_usd.toFixed(2)} / MTok`
    } else {
      price = 'asset-billed'
    }
  }

  lines.push({ prefix: own, label: node.label, detail: node.detail, price })

  if (node.children && node.children.length > 0) {
    const childPrefix = isRoot ? '' : prefix + (isLast ? '    ' : '│   ')
    node.children.forEach((child, i) => {
      const last = i === node.children!.length - 1
      lines.push(...renderTree(child, pricing, childPrefix, last, false))
    })
  }
  return lines
}

// ────────────────────────────────────────────────────────────────────────────

function decisionCategory(modelId: string): { label: string; order: number } {
  if (modelId.includes('-live') || modelId.includes('native-audio')) return { label: 'voice', order: 1 }
  if (modelId.startsWith('veo-')) return { label: 'video', order: 4 }
  if (modelId.includes('-image-preview') || modelId === 'gemini-2.5-flash-image' || modelId.startsWith('imagen-'))
    return { label: 'image', order: 3 }
  if (modelId.startsWith('lyria-')) return { label: 'music', order: 5 }
  if (modelId.includes('-tts')) return { label: 'speech', order: 6 }
  if (modelId.startsWith('gemini-embedding')) return { label: 'embeddings', order: 7 }
  if (modelId.includes('computer-use') || modelId.includes('deep-research') || modelId.includes('robotics'))
    return { label: 'specialized', order: 8 }
  return { label: 'text & agents', order: 2 }
}

function useOpenSample(samples: Sample[]) {
  const select = useSamples((s) => s.select)
  const go = useRoute((s) => s.go)
  const sampleById = useMemo(() => {
    const m = new Map<string, Sample>()
    for (const s of samples) m.set(s.id, s)
    return m
  }, [samples])
  return async (sampleId?: string) => {
    if (!sampleId) return
    const sample = sampleById.get(sampleId)
    if (sample) {
      await select(sample.id)
      go('samples')
    }
  }
}

function DecisionChartPanel({ samples }: { samples: Sample[] }) {
  const open = useOpenSample(samples)
  return (
    <Panel pad={false} className="overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-col gap-1">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.36em' }}
          >
            pick a model
          </span>
          <h2 className="text-[18px] font-medium leading-tight">
            What are you actually building?
          </h2>
        </div>
        <span
          className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          tap a leaf · jump to a sample
        </span>
      </div>

      <DecisionFlowChart open={open} />
    </Panel>
  )
}

function DecisionTablePanel({ samples }: { samples: Sample[] }) {
  const open = useOpenSample(samples)
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInScrollRoot(ref, { once: true, amount: 0.15 })

  const grouped = useMemo(() => {
    const buckets = new Map<string, { order: number; rows: typeof DECISIONS }>()
    for (const row of DECISIONS) {
      const cat = decisionCategory(row.pick)
      const b = buckets.get(cat.label) ?? { order: cat.order, rows: [] as typeof DECISIONS }
      b.rows.push(row)
      buckets.set(cat.label, b)
    }
    return [...buckets.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([label, b]) => ({ label, rows: b.rows }))
  }, [])

  let rowIndex = 0
  return (
    <Panel pad={false} className="overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-col gap-1">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.36em' }}
          >
            full decision list
          </span>
          <h2 className="text-[18px] font-medium leading-tight">
            Every goal → its current best model
          </h2>
        </div>
        <span
          className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          arrow buttons run the matching sample
        </span>
      </div>

      <div ref={ref}>
        {grouped.map((group) => (
          <section key={group.label} className="border-b border-[var(--border)] last:border-b-0">
            <div className="bg-[var(--surface-raised)] px-6 py-2">
              <span
                className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.32em' }}
              >
                {group.label}
              </span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {group.rows.map((row) => {
                const entry = findModelEntry(row.pick)
                const i = rowIndex++
                const flowVariants = {
                  initial: { opacity: 0, x: -8 },
                  animate: { opacity: 1, x: 0 },
                }
                return (
                  <motion.li
                    key={row.goal}
                    custom={i}
                    initial={reduced ? false : 'initial'}
                    animate={inView ? 'animate' : reduced ? 'animate' : 'initial'}
                    variants={flowVariants}
                    transition={{
                      duration: reduced ? 0 : 0.35,
                      delay: reduced ? 0 : i * 0.025,
                      ease: [0.2, 0.7, 0.2, 1],
                    }}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3 hover:bg-[var(--elev-1)]/60 transition-colors"
                  >
                    <span className="text-[13.5px] leading-snug text-[var(--text)]">{row.goal}</span>
                    <FlowArrow active={inView || !!reduced} delay={i * 0.025 + 0.1} />
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-[var(--text)]">
                        {entry?.display ?? row.pick}
                      </span>
                      <code className="font-mono text-[10.5px] text-[var(--text-subtle)]">{row.pick}</code>
                    </span>
                    {row.add ? (
                      <button
                        type="button"
                        onClick={() => void open(row.add)}
                        className="group flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--elev-1)] px-2.5 py-1 text-[10.5px] uppercase text-[var(--text-muted)] hover:border-[var(--accent-hairline)] hover:text-[var(--text)]"
                        style={{ letterSpacing: '0.18em' }}
                      >
                        <ArrowUpRight
                          size={11}
                          strokeWidth={1.5}
                          className="transition-transform group-hover:translate-x-[1px] group-hover:-translate-y-[1px]"
                        />
                        {row.add.split('.')[1] ?? row.add}
                      </button>
                    ) : (
                      <span />
                    )}
                  </motion.li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  )
}

/**
 * Branching flow chart from "what are you building?" to a concrete model.
 * Real diagram — not a list with arrows. Five category columns, each with
 * 2-3 leaf models, connector lines drawn as borders so they stay crisp at
 * any zoom and survive prefers-reduced-motion. Leaves are buttons; clicking
 * a leaf with a sample mapping jumps to that sample.
 */
function DecisionFlowChart({ open }: { open: (sampleId?: string) => void }) {
  const cols = DECISION_FLOW.length
  // Spine inset so it spans between the centres of the first and last category
  // columns rather than the page edges — gives the tree a real top-of-T shape.
  const spineInsetPct = 100 / (2 * cols)

  return (
    <div className="overflow-x-auto px-6 py-10">
      <div
        className="mx-auto flex flex-col items-stretch"
        style={{ minWidth: '1040px', maxWidth: '1240px' }}
      >
        {/* Root node */}
        <div className="flex justify-center">
          <div
            className="rounded-[var(--radius-md)] border border-[var(--accent-hairline)] bg-[var(--accent-soft)] px-6 py-3 text-center"
            style={{ boxShadow: 'var(--shadow-1)' }}
          >
            <span
              className="font-mono text-[9.5px] uppercase text-[var(--accent)]"
              style={{ letterSpacing: '0.36em' }}
            >
              start
            </span>
            <div className="text-[14px] font-medium leading-tight text-[var(--text)]">
              What are you building?
            </div>
          </div>
        </div>

        {/* Down to spine */}
        <div className="self-center h-7 w-px bg-[var(--border-strong)]" />

        {/* Spine — inset to first/last column centres */}
        <div className="relative h-px w-full">
          <div
            className="absolute top-0 h-px bg-[var(--border-strong)]"
            style={{ left: `${spineInsetPct}%`, right: `${spineInsetPct}%` }}
          />
        </div>

        {/* Drop lines into each category header */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {DECISION_FLOW.map((cat: FlowCategory) => (
            <div key={cat.id} className="flex justify-center">
              <div className="h-7 w-px bg-[var(--border-strong)]" />
            </div>
          ))}
        </div>

        {/* Category columns — each column owns its header + stacked leaves */}
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {DECISION_FLOW.map((cat: FlowCategory) => (
            <CategoryColumn key={cat.id} cat={cat} onOpen={open} />
          ))}
        </div>
      </div>
    </div>
  )
}

function CategoryColumn({
  cat,
  onOpen,
}: {
  cat: FlowCategory
  onOpen: (sampleId?: string) => void
}) {
  return (
    <div className="flex flex-col">
      {/* Category header */}
      <div className="rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--elev-2)] px-3 py-2.5 text-center">
        <span
          className="font-mono text-[9.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.32em' }}
        >
          {cat.kicker}
        </span>
        <div className="mt-0.5 text-[13px] font-medium leading-tight text-[var(--text)]">
          {cat.label}
        </div>
      </div>

      {/* Vertical guide + stacked leaves. Guide stops at the centre of the last
          leaf so it doesn't extend past the bottom of the column. */}
      <div className="relative mt-4 pl-4">
        <div
          className="absolute left-1.5 top-0 w-px bg-[var(--border)]"
          style={{ bottom: 'calc(50% / var(--leaf-count))' }}
          // bottom = half a leaf's worth — approximate; kept under guide so it
          // visually terminates at the last leaf's stub.
        />
        <div
          className="flex flex-col gap-2.5"
          style={{ ['--leaf-count' as string]: String(cat.kids.length) }}
        >
          {cat.kids.map((kid: FlowLeaf) => (
            <FlowLeafRow key={kid.model} leaf={kid} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FlowLeafRow({
  leaf,
  onOpen,
}: {
  leaf: FlowLeaf
  onOpen: (sampleId?: string) => void
}) {
  const interactive = !!leaf.sample
  const Tag = interactive ? 'button' : 'div'
  return (
    <div className="relative">
      {/* Stub from vertical guide into the leaf card */}
      <div className="absolute -left-2.5 top-1/2 h-px w-2.5 bg-[var(--border)]" />
      <Tag
        type={interactive ? 'button' : undefined}
        onClick={interactive ? () => void onOpen(leaf.sample) : undefined}
        className={cn(
          'group block w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-left transition-colors',
          interactive && 'hover:border-[var(--accent-hairline)] hover:bg-[var(--elev-1)] cursor-pointer',
        )}
      >
        <div className="text-[12px] leading-snug text-[var(--text)]">{leaf.label}</div>
        <code className="mt-1 block font-mono text-[10px] text-[var(--text-subtle)]">
          {leaf.model}
        </code>
        {interactive && (
          <div
            className="mt-1.5 flex items-center gap-1 font-mono text-[9px] uppercase text-[var(--text-subtle)] group-hover:text-[var(--accent)]"
            style={{ letterSpacing: '0.24em' }}
          >
            <ArrowUpRight size={9} strokeWidth={1.5} />
            run sample
          </div>
        )}
      </Tag>
    </div>
  )
}

function CapabilityMatrix() {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLTableSectionElement>(null)
  const inView = useInScrollRoot(ref, { once: true, amount: 0.15 })

  // Show the matrix for the families that have meaningful capability variation
  // — text and live. Image/video/embeddings have one inherent capability each
  // and are better represented on their family card, not in this grid.
  const rows = useMemo(
    () =>
      FAMILIES.filter((f) => f.id === 'text' || f.id === 'live').flatMap((f) =>
        f.models.map((m) => ({ family: f, model: m })),
      ),
    [],
  )

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          capabilities
        </span>
        <h2 className="text-[26px] font-medium leading-tight tracking-tight">
          What each model supports
        </h2>
        <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--text-muted)]">
          A scan-friendly view of who has thinking, tools, grounding, structured
          output, caching, streaming, chat, live, and asset modalities.
        </p>
      </div>
      <Panel pad={false} className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
              <th className="sticky left-0 z-10 bg-[var(--surface-raised)] px-4 py-3 text-left font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.18em' }}>
                model
              </th>
              {CAPABILITY_COLUMNS.map((c) => (
                <th
                  key={c.id}
                  className="px-3 py-3 text-center font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                  style={{ letterSpacing: '0.18em' }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={ref}>
            {rows.map(({ model }, rowIdx) => (
              <tr
                key={model.id}
                className={rowIdx % 2 === 0 ? 'bg-transparent' : 'bg-[var(--surface-raised)]/40'}
              >
                <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-[13px] text-[var(--text)]">{model.display}</span>
                    <code className="font-mono text-[10.5px] text-[var(--text-subtle)]">
                      {model.id}
                    </code>
                  </div>
                </td>
                {CAPABILITY_COLUMNS.map((c, colIdx) => {
                  const has = model.capabilities.includes(c.id)
                  // Stagger: rows top-to-bottom, then cells left-to-right within each row.
                  const delay = rowIdx * 0.04 + colIdx * 0.015
                  return (
                    <td key={c.id} className="px-3 py-2.5 text-center">
                      <motion.span
                        initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                        animate={inView ? { opacity: 1, scale: 1 } : reduced ? { opacity: 1 } : undefined}
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { duration: 0.3, delay, ease: [0.2, 0.7, 0.2, 1] }
                        }
                        className={
                          has
                            ? 'inline-block font-mono text-[14px] text-[var(--accent)]'
                            : 'inline-block font-mono text-[14px] text-[var(--text-subtle)]'
                        }
                        aria-label={has ? 'supported' : 'not supported'}
                      >
                        {has ? '●' : '–'}
                      </motion.span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Modality matrix — input modalities × output modalities per model. A different
// question than the capability matrix: who eats what, who emits what.

const INPUT_MODS = ['text', 'image', 'audio', 'video', 'pdf'] as const
const OUTPUT_MODS = ['text', 'image', 'audio', 'video', 'embedding'] as const

function ModalityMatrix() {
  const rows = useMemo(() => FAMILIES.flatMap((f) => f.models), [])

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          modalities
        </span>
        <h2 className="text-[26px] font-medium leading-tight tracking-tight">
          What each model eats and emits
        </h2>
        <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--text-muted)]">
          Input modalities on the left, output modalities on the right. Filled
          discs mean the modality is supported natively; gaps mean route through
          a different model in the family.
        </p>
      </div>
      <Panel pad={false} className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
              <th
                rowSpan={2}
                className="sticky left-0 z-10 bg-[var(--surface-raised)] px-4 py-3 text-left font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.18em' }}
              >
                model
              </th>
              <th
                colSpan={INPUT_MODS.length}
                className="border-l border-[var(--border)] px-3 py-2 text-center font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.28em' }}
              >
                input
              </th>
              <th
                colSpan={OUTPUT_MODS.length}
                className="border-l border-[var(--border)] px-3 py-2 text-center font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.28em' }}
              >
                output
              </th>
            </tr>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
              {INPUT_MODS.map((m, i) => (
                <th
                  key={`in-${m}`}
                  className={
                    'px-3 py-2 text-center font-mono text-[10px] uppercase text-[var(--text-subtle)]' +
                    (i === 0 ? ' border-l border-[var(--border)]' : '')
                  }
                  style={{ letterSpacing: '0.18em' }}
                >
                  {m}
                </th>
              ))}
              {OUTPUT_MODS.map((m, i) => (
                <th
                  key={`out-${m}`}
                  className={
                    'px-3 py-2 text-center font-mono text-[10px] uppercase text-[var(--text-subtle)]' +
                    (i === 0 ? ' border-l border-[var(--border)]' : '')
                  }
                  style={{ letterSpacing: '0.18em' }}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr
                key={m.id}
                className={i % 2 === 0 ? 'bg-transparent' : 'bg-[var(--surface-raised)]/40'}
              >
                <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-[13px] text-[var(--text)]">{m.display}</span>
                    <code className="font-mono text-[10.5px] text-[var(--text-subtle)]">{m.id}</code>
                  </div>
                </td>
                {INPUT_MODS.map((mod, idx) => {
                  const has = m.modalities.input.includes(mod)
                  return (
                    <td
                      key={`in-${mod}`}
                      className={
                        'px-3 py-2.5 text-center' +
                        (idx === 0 ? ' border-l border-[var(--border)]' : '')
                      }
                    >
                      <Mark on={has} tone="trace" />
                    </td>
                  )
                })}
                {OUTPUT_MODS.map((mod, idx) => {
                  const has = m.modalities.output.includes(mod)
                  return (
                    <td
                      key={`out-${mod}`}
                      className={
                        'px-3 py-2.5 text-center' +
                        (idx === 0 ? ' border-l border-[var(--border)]' : '')
                      }
                    >
                      <Mark on={has} tone="accent" />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </section>
  )
}

function Mark({ on, tone }: { on: boolean; tone: 'accent' | 'trace' }) {
  if (!on) return <span className="font-mono text-[14px] text-[var(--text-subtle)]">–</span>
  const color = tone === 'accent' ? 'var(--accent)' : 'var(--trace)'
  return (
    <span className="font-mono text-[14px]" style={{ color }} aria-label="supported">
      ●
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Cost ladder — sorted bar chart of input prices. Visual hierarchy of who's
// cheap, who's mid, who's expensive. Output rate appears as a secondary line.

function CostLadder() {
  const pricing = usePricing((s) => s.data)

  const rows = useMemo(() => {
    const all = FAMILIES.flatMap((f) => f.models)
    if (!pricing) return [] as { entry: ModelEntry; input: number; output: number }[]
    const out: { entry: ModelEntry; input: number; output: number }[] = []
    for (const entry of all) {
      let best = ''
      for (const id of Object.keys(pricing.rate_card)) {
        if (entry.id.startsWith(id) && id.length > best.length) best = id
      }
      if (!best) continue
      const r = pricing.rate_card[best]
      out.push({ entry, input: r.input_per_mtok_usd, output: r.output_per_mtok_usd })
    }
    return out.sort((a, b) => a.input - b.input)
  }, [pricing])

  const maxInput = rows.length > 0 ? Math.max(...rows.map((r) => r.input)) : 1
  const maxOutput = rows.length > 0 ? Math.max(...rows.map((r) => r.output)) : 1

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          cost ladder
        </span>
        <h2 className="text-[26px] font-medium leading-tight tracking-tight">
          The price hierarchy at a glance
        </h2>
        <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--text-muted)]">
          Sorted ascending by input price. Bars scale linearly within each
          column; the output rate uses its own scale so the two stay comparable
          across orders of magnitude. Asset-billed models (image, video, music)
          are not in this view — their bulk cost is per-asset, not per-token.
        </p>
      </div>
      <Panel pad={false} className="overflow-hidden">
        <div className="grid grid-cols-[minmax(220px,1fr)_minmax(0,3fr)_minmax(0,3fr)] gap-4 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.18em' }}
          >
            model
          </span>
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.18em' }}
          >
            input · $ / MTok
          </span>
          <span
            className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
            style={{ letterSpacing: '0.18em' }}
          >
            output · $ / MTok
          </span>
        </div>
        <ul>
          {rows.map(({ entry, input, output }, i) => (
            <li
              key={entry.id}
              className={
                'grid grid-cols-[minmax(220px,1fr)_minmax(0,3fr)_minmax(0,3fr)] items-center gap-4 px-5 py-2.5' +
                (i % 2 === 0 ? '' : ' bg-[var(--surface-raised)]/40')
              }
            >
              <div className="flex flex-col">
                <span className="text-[13px] text-[var(--text)]">{entry.display}</span>
                <code className="font-mono text-[10.5px] text-[var(--text-subtle)]">{entry.id}</code>
              </div>
              <Bar value={input} max={maxInput} tone="accent" />
              <Bar value={output} max={maxOutput} tone="trace" />
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  )
}

function Bar({ value, max, tone }: { value: number; max: number; tone: 'accent' | 'trace' }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  const color =
    tone === 'accent' ? 'var(--accent)' : 'var(--trace)'
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 flex-1 rounded-full bg-[var(--elev-2)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: color, opacity: 0.8 }}
        />
      </div>
      <span className="numeric w-16 text-right font-mono text-[12px] text-[var(--text)]">
        ${value.toFixed(2)}
      </span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Migration ladder — explicit prior → current with the rationale, hand curated.

function MigrationLadder() {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          migration
        </span>
        <h2 className="text-[26px] font-medium leading-tight tracking-tight">
          From prior to current
        </h2>
        <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--text-muted)]">
          Each row is a defensible jump — the price difference, capability
          delta, and one-line caveat. Use this when a customer asks "what
          should I migrate to" and you want to answer in a sentence.
        </p>
      </div>
      <Panel pad={false} className="overflow-hidden">
        <ul className="divide-y divide-[var(--border)]">
          {MIGRATIONS.map((step) => {
            const fromEntry = findModelEntry(step.from)
            const toEntry = findModelEntry(step.to)
            return (
              <li
                key={`${step.from}->${step.to}`}
                className="grid grid-cols-1 gap-3 px-6 py-4 lg:grid-cols-[1.5fr_1.5fr_3fr]"
              >
                <div className="flex flex-col">
                  <span
                    className="font-mono text-[10px] uppercase text-[var(--text-subtle)]"
                    style={{ letterSpacing: '0.28em' }}
                  >
                    from
                  </span>
                  <span className="text-[13px] text-[var(--text)]">
                    {fromEntry?.display ?? step.from}
                  </span>
                  <code className="font-mono text-[10.5px] text-[var(--text-subtle)]">
                    {step.from}
                  </code>
                </div>
                <div className="flex flex-col">
                  <span
                    className="font-mono text-[10px] uppercase text-[var(--accent)]"
                    style={{ letterSpacing: '0.28em' }}
                  >
                    →  to
                  </span>
                  <span className="text-[13px] text-[var(--text)]">
                    {toEntry?.display ?? step.to}
                  </span>
                  <code className="font-mono text-[10.5px] text-[var(--text-subtle)]">
                    {step.to}
                  </code>
                </div>
                <p className="text-[13px] leading-relaxed text-[var(--text-muted)] lg:border-l lg:border-[var(--border)] lg:pl-4">
                  {step.rationale}
                </p>
              </li>
            )
          })}
        </ul>
      </Panel>
    </section>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Insight panels — empirical, citation-backed. Data lives in src/data/insights.ts.

function SourceLine({ url, label }: { url: string; label: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-subtle)]">
      <span
        className="font-mono uppercase"
        style={{ letterSpacing: '0.18em' }}
      >
        source
      </span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
      >
        {label}
      </a>
      <span aria-hidden>·</span>
      <span className="font-mono numeric">as of {ACCESSED}</span>
    </div>
  )
}

function SectionHeader({
  kicker,
  title,
  blurb,
}: {
  kicker: string
  title: string
  blurb: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.36em' }}
      >
        {kicker}
      </span>
      <h2 className="text-[26px] font-medium leading-tight tracking-tight">{title}</h2>
      <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--text-muted)]">{blurb}</p>
    </div>
  )
}

// 1. Generation jump — 2.5 → 3 across the family
function GenerationJumpPanel() {
  const ref = useRef<HTMLUListElement>(null)
  const inView = useInScrollRoot(ref, { once: true, amount: 0.15 })
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker="generation jump"
        title="What 2.5 → 3 actually bought you"
        blurb="Side-by-side scores on the same benchmarks across consecutive Gemini generations. The headline isn't 'better at MMLU' — it's order-of-magnitude jumps on agentic and tool-use evals where 2.5 was effectively zero."
      />
      <Panel pad={false} className="overflow-hidden">
        <div className="grid grid-cols-[2fr_minmax(60px,1fr)_minmax(60px,1fr)_minmax(60px,80px)_minmax(60px,80px)] gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
          <Kicker>benchmark</Kicker>
          <Kicker>family</Kicker>
          <Kicker className="text-right">2.5</Kicker>
          <Kicker className="text-right">3 / 3.1</Kicker>
          <Kicker className="text-right">delta</Kicker>
        </div>
        <ul ref={ref}>
          {GENERATION_JUMPS.map((j, i) => (
            <li
              key={`${j.benchmark}-${j.family}`}
              className={
                'grid grid-cols-[2fr_minmax(60px,1fr)_minmax(60px,1fr)_minmax(60px,80px)_minmax(60px,80px)] items-center gap-3 px-5 py-2.5' +
                (i % 2 === 1 ? ' bg-[var(--surface-raised)]/40' : '')
              }
            >
              <span className="text-[13px] text-[var(--text)]">{j.benchmark}</span>
              <span className="font-mono text-[11px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.18em' }}>
                {j.family}
              </span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text-muted)]">{j.before}</span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text)]">{j.after}</span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--accent)]">
                <CountUpDelta value={j.multiple_or_pct} active={inView} delay={i * 0.06} />
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <SourceLine url={BENCHMARK_SOURCE.url} label={BENCHMARK_SOURCE.label} />
    </section>
  )
}

/**
 * Count-up animation for the delta column. Parses numeric strings like
 * "13×", "+103%", "+74%", "9.5×", "+32%" and tweens from 0 to the final
 * value while preserving the surrounding format. Falls back to the static
 * string when prefers-reduced-motion is on or the format isn't parseable.
 */
function CountUpDelta({ value, active, delay }: { value: string; active: boolean; delay: number }) {
  const reduced = useReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : '–')

  // Parse: leading "+", numeric (with optional decimal), trailing "×" or "%".
  const match = value.match(/^([+\-]?)(\d+(?:\.\d+)?)([×%])$/)

  useEffect(() => {
    if (!active || reduced || !match) {
      setDisplay(value)
      return
    }
    const [, sign, numStr, suffix] = match
    const target = parseFloat(numStr)
    const isFloat = numStr.includes('.')
    const start = performance.now()
    const duration = 700
    let raf = 0

    const tick = (t: number) => {
      const elapsed = t - start - delay * 1000
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick)
        return
      }
      const p = Math.min(1, elapsed / duration)
      // Ease-out cubic.
      const eased = 1 - Math.pow(1 - p, 3)
      const current = target * eased
      const formatted = isFloat ? current.toFixed(1) : Math.round(current).toString()
      setDisplay(`${sign}${formatted}${suffix}`)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, value, delay, reduced, match])

  return <>{display}</>
}

// 2. Flash beats Pro — published comparison highlights
function FlashVsProPanel() {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker="flash punches up"
        title="Where Gemini 3 Flash matches or beats 3 Pro"
        blurb="Pro is not a strict superset. On agentic coding, MCP tool use, and long-horizon tasks, Flash either ties or wins — at one-quarter the price. Treat 3 Flash as the default; reach for Pro on reasoning depth, hallucination resistance, and Vending-Bench-style coherence."
      />
      <Panel pad={false} className="overflow-hidden">
        <div className="grid grid-cols-[2fr_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)] gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
          <Kicker>benchmark</Kicker>
          <Kicker className="text-right">3 Flash</Kicker>
          <Kicker className="text-right">3 Pro</Kicker>
          <Kicker className="text-right">flash − pro</Kicker>
        </div>
        <ul>
          {FLASH_VS_PRO.map((row, i) => (
            <li
              key={row.benchmark}
              className={
                'grid grid-cols-[2fr_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)] items-center gap-3 px-5 py-2.5' +
                (i % 2 === 1 ? ' bg-[var(--surface-raised)]/40' : '')
              }
            >
              <span className="text-[13px] text-[var(--text)]">{row.benchmark}</span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text)]">{row.flash}</span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text-muted)]">{row.pro}</span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--accent)]">{row.delta}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="grid gap-3 lg:grid-cols-3">
        <PullQuote q={PULL_QUOTES.flash_throughput} />
        <PullQuote q={PULL_QUOTES.flash_vs_pro_speed} />
        <PullQuote q={PULL_QUOTES.flash_token_efficiency} />
      </div>
      <SourceLine url={BENCHMARK_SOURCE.url} label={BENCHMARK_SOURCE.label} />
    </section>
  )
}

type PullQuoteData = (typeof PULL_QUOTES)[keyof typeof PULL_QUOTES]

function PullQuote({ q }: { q: PullQuoteData }) {
  return (
    <Panel className="flex flex-col gap-2">
      <p className="font-display text-[18px] leading-snug text-[var(--text)]" style={{ fontWeight: 500 }}>
        {q.text}
      </p>
      <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">{q.context}</p>
      <a
        href={q.source}
        target="_blank"
        rel="noreferrer"
        className="mt-1 font-mono text-[10.5px] uppercase text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
        style={{ letterSpacing: '0.18em' }}
      >
        {q.label}
      </a>
    </Panel>
  )
}

// 2b. Flash-Lite in context — the cheapest 3.x tier
function FlashLitePanel() {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker="3.1 flash-lite"
        title="The cheapest 3.x tier — and where it earns its place"
        blurb="Lite is the volume model. At $0.25/MTok input ($0.50 audio), it costs half of 3 Flash and runs at a published 363 tok/s. Holds graduate-level science (GPQA 86.9%) and multimodal reasoning (MMMU-Pro 76.8%); folds on deep reasoning (HLE 16% vs Flash's 33.7%) and at the 1M context depth."
      />
      <Panel pad={false} className="overflow-hidden">
        <ul className="divide-y divide-[var(--border)]">
          {FLASH_LITE_HIGHLIGHTS.map((h) => (
            <li
              key={h.metric}
              className="grid grid-cols-1 gap-2 px-5 py-3 lg:grid-cols-[1.4fr_1fr_3fr]"
            >
              <span
                className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.18em' }}
              >
                {h.metric}
              </span>
              <span className="numeric font-mono text-[14px] text-[var(--text)]">{h.value}</span>
              <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">{h.context}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="bg-[var(--surface-raised)]">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.18em' }}
        >
          not published for flash-lite
        </span>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          Google does not publish Flash-Lite scores for{' '}
          {FLASH_LITE_NOT_PUBLISHED.join(' · ')}. Cells in the comparison
          table below are intentionally blank — community leaderboards drift
          fast and we don't fabricate.
        </p>
      </Panel>
      <SourceLine url={FLASH_LITE_SOURCE.url} label={FLASH_LITE_SOURCE.label} />
    </section>
  )
}

// 3. Frontier comparison — split across two slides so each fits a single viewport.
//    Part A: reasoning + multimodal. Part B: coding + agentic + long-context.

function FrontierComparison({
  groups,
  partLabel,
}: {
  groups: BenchmarkRow['group'][]
  partLabel?: string
}) {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker={partLabel ? `frontier · ${partLabel}` : 'frontier comparison'}
        title="Gemini 3 vs the rest, by group"
        blurb="The same evaluation table Google publishes in the 3 Flash model card. Showing all four frontier models, not just Gemini, so the win/loss pattern stays honest. Bold cell = leader in the row."
      />
      {groups.map((group) => (
        <FrontierGroup key={group} group={group} />
      ))}
      <SourceLine url={BENCHMARK_SOURCE.url} label={BENCHMARK_SOURCE.label} />
    </section>
  )
}

function FrontierGroup({ group }: { group: BenchmarkRow['group'] }) {
  const rows = useMemo(
    () => BENCHMARK_TABLE.filter((r) => r.group === group),
    [group],
  )
  return (
    <Panel pad={false} className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.28em' }}
        >
          {group}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="sticky left-0 bg-[var(--elev-1)] px-5 py-2.5 font-mono text-[10.5px] uppercase text-[var(--text-subtle)]" style={{ letterSpacing: '0.18em' }}>
                benchmark
              </th>
              {[
                ['3 Flash', 'gemini_3_flash'],
                ['3 Pro', 'gemini_3_pro'],
                ['3.1 Lite', 'gemini_3_1_flash_lite'],
                ['2.5 Flash', 'gemini_2_5_flash'],
                ['2.5 Pro', 'gemini_2_5_pro'],
                ['Sonnet 4.5', 'claude_sonnet_4_5'],
                ['GPT-5.2', 'gpt_5_2'],
                ['Grok 4.1', 'grok_4_1_fast'],
              ].map(([label]) => (
                <th
                  key={label}
                  className="px-3 py-2.5 text-right font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                  style={{ letterSpacing: '0.18em' }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <FrontierRow row={row} alt={i % 2 === 1} key={row.benchmark} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function FrontierRow({ row, alt }: { row: BenchmarkRow; alt: boolean }) {
  const cells: Array<[string, keyof BenchmarkRow]> = [
    ['gemini_3_flash', 'gemini_3_flash'],
    ['gemini_3_pro', 'gemini_3_pro'],
    ['gemini_3_1_flash_lite', 'gemini_3_1_flash_lite'],
    ['gemini_2_5_flash', 'gemini_2_5_flash'],
    ['gemini_2_5_pro', 'gemini_2_5_pro'],
    ['claude_sonnet_4_5', 'claude_sonnet_4_5'],
    ['gpt_5_2', 'gpt_5_2'],
    ['grok_4_1_fast', 'grok_4_1_fast'],
  ]
  // Determine the leader cell to bold.
  const leaderKey = useMemo(() => {
    let best: { key: string; value: number } | null = null
    for (const [, k] of cells) {
      const raw = row[k] as string | null
      const num = parseScore(raw)
      if (num == null) continue
      const cmp = row.higher_is_better ? num : -num
      if (!best || cmp > best.value) best = { key: k as string, value: cmp }
    }
    return best?.key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row])

  return (
    <tr className={alt ? 'bg-[var(--surface-raised)]/40' : ''}>
      <td className="sticky left-0 bg-inherit px-5 py-2.5">
        <div className="flex flex-col">
          <span className="text-[13px] text-[var(--text)]">{row.benchmark}</span>
          <span className="text-[11.5px] text-[var(--text-subtle)]">
            {row.description}
            {row.note ? ` · ${row.note}` : ''}
          </span>
        </div>
      </td>
      {cells.map(([id, key]) => {
        const value = (row[key] as string | null) ?? '–'
        const isLeader = id === leaderKey
        return (
          <td
            key={id}
            className={
              'numeric px-3 py-2.5 text-right font-mono text-[12.5px] ' +
              (isLeader ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-muted)]')
            }
          >
            {value}
          </td>
        )
      })}
    </tr>
  )
}

function parseScore(s: string | null): number | null {
  if (!s || s === 'n/s') return null
  // Strip $, commas, percent — leave digits / decimal.
  const cleaned = s.replace(/[\$,%\s]/g, '').replace(/Elo/i, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

// 4. Long-context honesty — 128K vs 1M, rendered as a paired bar chart.
function LongContextHonesty() {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLUListElement>(null)
  const inView = useInScrollRoot(ref, { once: true, amount: 0.15 })

  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker="long-context reality check"
        title="The 1M context window degrades. Stay under 200K."
        blurb="MRCR v2 is Google's own multi-needle retrieval benchmark. At 128K input every Gemini 3 model holds above 60%; at 1M pointwise the same models drop into the 12–26% band. The window is real, the recall at depth is not. Architect for explicit retrieval over deep context."
      />
      <Panel pad={false} className="overflow-hidden">
        <div className="grid grid-cols-[1.4fr_3fr_3fr_minmax(60px,80px)] gap-4 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
          <Kicker>model</Kicker>
          <Kicker>@ 128k input · MRCR v2</Kicker>
          <Kicker>@ 1m input · MRCR v2</Kicker>
          <Kicker className="text-right">drop</Kicker>
        </div>
        <ul ref={ref}>
          {LONG_CONTEXT.map((row, i) => {
            const a = parseScore(row.at_128k) ?? 0
            const b = parseScore(row.at_1m) ?? 0
            const drop = a > 0 ? Math.round(((a - b) / a) * 100) : 0
            return (
              <li
                key={row.model}
                className={
                  'grid grid-cols-[1.4fr_3fr_3fr_minmax(60px,80px)] items-center gap-4 px-5 py-2.5' +
                  (i % 2 === 1 ? ' bg-[var(--surface-raised)]/40' : '')
                }
              >
                <code className="truncate font-mono text-[11.5px] text-[var(--text)]">{row.model}</code>
                <ScoreBar
                  value={row.at_128k}
                  pct={a}
                  tone="accent"
                  active={inView || !!reduced}
                  delay={i * 0.06}
                />
                <ScoreBar
                  value={row.at_1m}
                  pct={b}
                  tone="muted"
                  active={inView || !!reduced}
                  delay={i * 0.06 + 0.08}
                />
                <span className="numeric text-right font-mono text-[12.5px] text-[var(--accent)]">
                  −{drop}%
                </span>
              </li>
            )
          })}
        </ul>
      </Panel>
      <SourceLine url={BENCHMARK_SOURCE.url} label={BENCHMARK_SOURCE.label} />
    </section>
  )
}

// Animated arrow for the decision flow — strokes its line in left-to-right
// when the slide enters viewport, then sits as a static accent glyph.
function FlowArrow({ active, delay }: { active: boolean; delay: number }) {
  const reduced = useReducedMotion()
  return (
    <svg width="32" height="12" viewBox="0 0 32 12" fill="none" className="shrink-0">
      <motion.path
        d="M2 6 L26 6"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={reduced ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        animate={active ? { pathLength: 1, opacity: 0.7 } : undefined}
        transition={reduced ? { duration: 0 } : { duration: 0.35, delay, ease: 'easeOut' }}
      />
      <motion.path
        d="M22 2 L28 6 L22 10"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={reduced ? { opacity: 1 } : { opacity: 0 }}
        animate={active ? { opacity: 0.85 } : undefined}
        transition={reduced ? { duration: 0 } : { duration: 0.2, delay: delay + 0.3 }}
      />
    </svg>
  )
}

function ScoreBar({
  value,
  pct,
  tone,
  active,
  delay,
}: {
  value: string
  pct: number
  tone: 'accent' | 'muted'
  active: boolean
  delay: number
}) {
  const reduced = useReducedMotion()
  const color = tone === 'accent' ? 'var(--accent)' : 'var(--text-subtle)'
  const finalWidth = `${Math.max(2, Math.min(100, pct))}%`
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 flex-1 rounded-full bg-[var(--elev-2)]">
        <motion.div
          initial={reduced ? { width: finalWidth } : { width: 0 }}
          animate={active ? { width: finalWidth } : undefined}
          transition={reduced ? { duration: 0 } : { duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color, opacity: tone === 'accent' ? 0.85 : 0.45 }}
        />
      </div>
      <span className="numeric w-12 text-right font-mono text-[12px] text-[var(--text-muted)]">
        {value}
      </span>
    </div>
  )
}

// 5. Modality token costs
function ModalityTokenCosts() {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker="modality math"
        title="What an image, a minute of audio, and a minute of video actually cost"
        blurb="Inputs are billed in tokens regardless of modality. The conversion factors are stable across the family — internalize them once, then estimate any cost back-of-envelope without a calculator."
      />
      <Panel pad={false} className="overflow-hidden">
        <div className="grid gap-px bg-[var(--border)]">
          {MODALITY_TOKENS.map((row) => (
            <div key={row.modality} className="grid grid-cols-[1.4fr_1.4fr_2.2fr] items-baseline gap-3 bg-[var(--elev-1)] px-5 py-3.5">
              <span className="text-[13px] text-[var(--text)]">{row.modality}</span>
              <span className="numeric font-mono text-[12.5px] text-[var(--text-muted)]">{row.equivalence}</span>
              <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">{row.headline}</span>
            </div>
          ))}
        </div>
      </Panel>
      <SourceLine url={MODALITY_SOURCE.url} label={MODALITY_SOURCE.label} />
    </section>
  )
}

// 6. Cache break-even
function CacheBreakeven() {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker="cache break-even"
        title="When explicit caching pays off"
        blurb="Cached input is ~90% off on Flash and ~84% off on Pro, but caches carry hourly storage fees ($1/MTok/hr Flash, $4.50/MTok/hr Pro). The break-even point — calls per TTL window after which the cache wins — depends on prefix size and tier. The default 1-hour TTL means most agentic loops hit break-even by the third call."
      />
      <Panel pad={false} className="overflow-hidden">
        <div className="grid grid-cols-[1.6fr_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)] gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
          <Kicker>model</Kicker>
          <Kicker className="text-right">prefix</Kicker>
          <Kicker className="text-right">no cache / call</Kicker>
          <Kicker className="text-right">storage / hr</Kicker>
          <Kicker className="text-right">cache / call</Kicker>
          <Kicker className="text-right">break-even</Kicker>
        </div>
        <ul>
          {CACHE_BREAKEVEN.map((row, i) => (
            <li
              key={row.model + row.prefix_tokens}
              className={
                'grid grid-cols-[1.6fr_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)] items-center gap-3 px-5 py-2.5' +
                (i % 2 === 1 ? ' bg-[var(--surface-raised)]/40' : '')
              }
            >
              <code className="truncate font-mono text-[12.5px] text-[var(--text)]">{row.model}</code>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text-muted)]">
                {(row.prefix_tokens / 1000).toFixed(0)}k
              </span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text-muted)]">
                ${row.no_cache_per_call_usd.toFixed(4)}
              </span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text-muted)]">
                ${row.cache_storage_usd.toFixed(3)}
              </span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text)]">
                ${row.cache_per_call_usd.toFixed(4)}
              </span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--accent)]">
                {row.break_even_calls} calls
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <SourceLine url={CACHE_SOURCE.url} label={CACHE_SOURCE.label} />
    </section>
  )
}

// 7. Long-context tier pricing boundary
function LongContextTierPanel() {
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker="200k tier boundary"
        title="Pro models double input rates above 200K tokens"
        blurb="The Pro family carries a long-context tier. Cross 200K on a single call and your input rate doubles, output goes up 50%. Combined with the MRCR-v2 degradation above 200K, this is a hard architectural ceiling — chunk + retrieve, don't dump."
      />
      <Panel pad={false} className="overflow-hidden">
        <div className="grid grid-cols-[2fr_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)] gap-3 border-b border-[var(--border)] bg-[var(--surface-raised)] px-5 py-3">
          <Kicker>model</Kicker>
          <Kicker className="text-right">input ≤200k</Kicker>
          <Kicker className="text-right">input &gt;200k</Kicker>
          <Kicker className="text-right">output ≤200k</Kicker>
          <Kicker className="text-right">output &gt;200k</Kicker>
        </div>
        <ul>
          {LONG_CONTEXT_TIER.map((row, i) => (
            <li
              key={row.model}
              className={
                'grid grid-cols-[2fr_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(80px,1fr)] items-center gap-3 px-5 py-2.5' +
                (i % 2 === 1 ? ' bg-[var(--surface-raised)]/40' : '')
              }
            >
              <code className="font-mono text-[12.5px] text-[var(--text)]">{row.model}</code>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text-muted)]">${row.input_below.toFixed(2)}</span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--accent)]">${row.input_above.toFixed(2)}</span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--text-muted)]">${row.output_below.toFixed(2)}</span>
              <span className="numeric text-right font-mono text-[12.5px] text-[var(--accent)]">${row.output_above.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <SourceLine url="https://ai.google.dev/pricing" label="Gemini API pricing" />
    </section>
  )
}

// 8. Grounding migration ROI
function GroundingMigration() {
  const m = GROUNDING_MIGRATION
  return (
    <section className="flex flex-col gap-5">
      <SectionHeader
        kicker="quiet win on migration"
        title="Grounded search and maps got 60% cheaper from 2.5 → 3.x"
        blurb="One of the less-advertised migration wins: per-1K grounding queries dropped from $35 (Search) and $25 (Maps) on the 2.5 family to a flat $14 on 3.x. A search-grounded RAG product with 100K queries/month moves from $3,500 to $1,400 in grounding fees alone."
      />
      <Panel className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Kicker>before · 2.5 family</Kicker>
          <p className="numeric font-mono text-[18px] text-[var(--text-muted)]">
            ${m.before.search} <span className="text-[12px] text-[var(--text-subtle)]">/ 1K Search</span>
          </p>
          <p className="numeric font-mono text-[18px] text-[var(--text-muted)]">
            ${m.before.maps} <span className="text-[12px] text-[var(--text-subtle)]">/ 1K Maps</span>
          </p>
          <p className="text-[12px] text-[var(--text-subtle)]">
            free tier: {m.before.free_search_rpd.toLocaleString()} Search RPD,{' '}
            {m.before.free_maps_rpd.toLocaleString()} Maps RPD (Pro)
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Kicker>after · 3.x family</Kicker>
          <p className="numeric font-mono text-[18px] text-[var(--accent)]">
            ${m.after.search} <span className="text-[12px] text-[var(--text-subtle)]">/ 1K Search & Maps</span>
          </p>
          <p className="text-[12px] text-[var(--text-subtle)]">
            free tier: {m.after.free_per_month.toLocaleString()} prompts / month
          </p>
          <p className="numeric mt-2 font-mono text-[14px] text-[var(--text)]">
            −{m.savings_pct_search}% Search · −{m.savings_pct_maps}% Maps
          </p>
        </div>
      </Panel>
      <SourceLine url="https://ai.google.dev/pricing" label="Gemini API pricing" />
    </section>
  )
}

// (Best-practice panels moved to /practices route — see routes/Practices.tsx.)

// Tiny helper used across the new panels.
function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={
        'font-mono text-[10.5px] uppercase text-[var(--text-subtle)] ' + (className ?? '')
      }
      style={{ letterSpacing: '0.18em' }}
    >
      {children}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function PriceFragment({ label, value }: { label: string; value: number }) {
  return (
    <span className="numeric font-mono text-[12px] text-[var(--text)]">
      <span
        className="mr-1 text-[10px] uppercase text-[var(--text-subtle)]"
        style={{ letterSpacing: '0.18em' }}
      >
        {label}
      </span>
      ${value.toFixed(2)}
      <span className="ml-0.5 text-[10px] text-[var(--text-subtle)]">/MTok</span>
    </span>
  )
}
