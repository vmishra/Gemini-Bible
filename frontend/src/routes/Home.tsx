import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import {
  CAPABILITY_COLUMNS,
  DECISIONS,
  FAMILIES,
  HOME_SECTION_ORDER,
  MIGRATIONS,
  SUPERGROUPS,
  TIER_LABEL,
  TIER_ORDER,
  findModelEntry,
  type ModelEntry,
  type ModelFamily,
  type ModelTier,
  type Supergroup,
} from '../data/catalog'
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

  return (
    <section className="flex flex-1 flex-col overflow-y-auto">
      <header className="border-b border-[var(--border)] px-10 py-10">
        <BuiltOnLockup />
        <span
          className="mt-8 block font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          the family
        </span>
        <h1 className="mt-3 font-display text-[44px] leading-[1.05]" style={{ fontWeight: 500 }}>
          The Gemini lineup, the way you actually pick a model.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
          One page per family. Pricing pulled live from the rate card. When-to-use
          copy written for engineers who have already read the docs and need a
          decision, not a tour.
        </p>
        <div
          aria-hidden
          className="mt-8 h-px w-60"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--accent-hairline) 20%, var(--accent-hairline) 80%, transparent)',
          }}
        />
      </header>

      <div className="flex flex-col gap-12 px-10 py-10">
        <DecisionPanel samples={samples} />

        <FamilyTree />

        {renderSections(samplesByModel)}

        <CapabilityMatrix />

        <ModalityMatrix />

        <CostLadder />

        <MigrationLadder />


        <footer className="mt-4 border-t border-[var(--border)] pt-8">
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
      </div>
    </section>
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

function DecisionPanel({ samples }: { samples: Sample[] }) {
  const select = useSamples((s) => s.select)
  const go = useRoute((s) => s.go)

  const sampleById = useMemo(() => {
    const m = new Map<string, Sample>()
    for (const s of samples) m.set(s.id, s)
    return m
  }, [samples])

  const open = async (sampleId?: string) => {
    if (!sampleId) return
    const sample = sampleById.get(sampleId)
    if (sample) {
      await select(sample.id)
      go('samples')
    }
  }

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
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {DECISIONS.map((row) => {
          const entry = findModelEntry(row.pick)
          return (
            <li
              key={row.goal}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-3 hover:bg-[var(--elev-1)]/60 transition-colors"
            >
              <span className="text-[13.5px] leading-snug text-[var(--text)]">{row.goal}</span>
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
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function CapabilityMatrix() {
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
          <tbody>
            {rows.map(({ model }, i) => (
              <tr
                key={model.id}
                className={i % 2 === 0 ? 'bg-transparent' : 'bg-[var(--surface-raised)]/40'}
              >
                <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5">
                  <div className="flex flex-col">
                    <span className="text-[13px] text-[var(--text)]">{model.display}</span>
                    <code className="font-mono text-[10.5px] text-[var(--text-subtle)]">
                      {model.id}
                    </code>
                  </div>
                </td>
                {CAPABILITY_COLUMNS.map((c) => {
                  const has = model.capabilities.includes(c.id)
                  return (
                    <td key={c.id} className="px-3 py-2.5 text-center">
                      <span
                        className={
                          has
                            ? 'font-mono text-[14px] text-[var(--accent)]'
                            : 'font-mono text-[14px] text-[var(--text-subtle)]'
                        }
                        aria-label={has ? 'supported' : 'not supported'}
                      >
                        {has ? '●' : '–'}
                      </span>
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
