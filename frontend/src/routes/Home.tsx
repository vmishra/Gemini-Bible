import { useMemo } from 'react'
import { ArrowUpRight } from 'lucide-react'
import {
  CAPABILITY_COLUMNS,
  DECISIONS,
  FAMILIES,
  TIER_LABEL,
  TIER_ORDER,
  findModelEntry,
  type ModelEntry,
  type ModelFamily,
  type ModelTier,
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
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
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

        {FAMILIES.map((family) => (
          <FamilyBlock key={family.id} family={family} samplesByModel={samplesByModel} />
        ))}

        <CapabilityMatrix />


        <footer className="mt-4 border-t border-[var(--border)] pt-8 text-[13px] text-[var(--text-subtle)]">
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
        </footer>
      </div>
    </section>
  )
}

function FamilyBlock({
  family,
  samplesByModel,
}: {
  family: ModelFamily
  samplesByModel: Map<string, Sample[]>
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
        <h2 className="text-[26px] font-medium leading-tight tracking-tight">{family.label}</h2>
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
