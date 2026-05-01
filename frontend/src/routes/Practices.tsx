import { ExternalLink } from 'lucide-react'
import { Slide, SlideShell } from '../ui/Slides'
import { Panel } from '../ui/components/Panel'
import {
  ACCESSED,
  INTERACTIONS_SOURCE,
  INTERACTIONS_VS_GENERATE,
  PRACTICE_SECTIONS,
  type PracticeRule,
  type PracticeSection,
} from '../data/insights'

/**
 * Practices — domain best-practices, every rule cited to its official source.
 * Lives at the `practices` route to keep the home page from carrying the full
 * weight of four separate best-practice domains.
 */

export function Practices() {
  return (
    <SlideShell>
      <Slide id="practices-hero" name="Best practices" className="justify-center">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          best practices
        </span>
        <h1
          className="mt-3 font-display text-[52px] leading-[1.05]"
          style={{ fontWeight: 500 }}
        >
          What the docs actually say to do.
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[var(--text-muted)]">
          Four domains — Gemini 3 prompting, image generation, the Live API,
          and multi-turn chat. Every rule is paraphrased tightly from an
          official Google page; the source URL sits next to it. Refresh the
          set whenever a model family ships a new release.
        </p>
        <div
          aria-hidden
          className="mt-10 h-px w-60"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--accent-hairline) 20%, var(--accent-hairline) 80%, transparent)',
          }}
        />
        <p className="mt-8 max-w-xl text-[12.5px] text-[var(--text-subtle)]">
          press ↓ to advance · arrow keys / Page Up · Page Down · Home · End
        </p>
      </Slide>

      {PRACTICE_SECTIONS.map((section) => (
        <Slide key={section.id} id={`practices-${section.id}`} name={section.label}>
          <PracticeSectionView section={section} />
        </Slide>
      ))}

      <Slide id="practices-interactions-vs-generate" name="Interactions vs generate_content">
        <InteractionsVsGenerate />
      </Slide>

      <Slide id="practices-colophon" name="Sources" full={false}>
        <div className="border-t border-[var(--border)] pt-8">
          <h2 className="font-display text-[24px] leading-tight" style={{ fontWeight: 500 }}>
            Source pages
          </h2>
          <ul className="mt-6 flex flex-col gap-2 text-[13px]">
            {[
              ...PRACTICE_SECTIONS.map((s) => ({
                label: s.primary_source_label,
                url: s.primary_source_url,
              })),
              { label: INTERACTIONS_SOURCE.label, url: INTERACTIONS_SOURCE.url },
            ].map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-baseline gap-2 text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
                >
                  {s.label}
                  <ExternalLink size={11} strokeWidth={1.5} className="translate-y-[1px] opacity-60 group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[12px] text-[var(--text-subtle)]">
            All accessed {ACCESSED}. Pages drift — re-verify quarterly.
          </p>
        </div>
      </Slide>
    </SlideShell>
  )
}

function PracticeSectionView({ section }: { section: PracticeSection }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          {section.kicker}
        </span>
        <h2 className="text-[28px] font-medium leading-tight tracking-tight">{section.label}</h2>
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-[var(--text-muted)]">
          {section.blurb}
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {section.rules.map((rule) => (
          <RuleCard key={rule.title} rule={rule} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-subtle)]">
        <span className="font-mono uppercase" style={{ letterSpacing: '0.18em' }}>
          source
        </span>
        <a
          href={section.primary_source_url}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
        >
          {section.primary_source_label}
        </a>
        <span aria-hidden>·</span>
        <span className="font-mono numeric">as of {ACCESSED}</span>
      </div>
    </div>
  )
}

function RuleCard({ rule }: { rule: PracticeRule }) {
  return (
    <Panel className="flex flex-col gap-2">
      <span
        className="font-mono text-[10.5px] uppercase text-[var(--accent)]"
        style={{ letterSpacing: '0.28em' }}
      >
        rule
      </span>
      <h3 className="text-[15px] font-medium leading-snug">{rule.title}</h3>
      <p className="text-[13px] leading-relaxed text-[var(--text)]">{rule.rule}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{rule.why}</p>
      <a
        href={rule.source}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex items-baseline gap-1.5 font-mono text-[10px] uppercase text-[var(--text-subtle)] hover:text-[var(--text-muted)]"
        style={{ letterSpacing: '0.18em' }}
      >
        cite
        <ExternalLink size={10} strokeWidth={1.5} className="translate-y-[1px]" />
      </a>
    </Panel>
  )
}

function InteractionsVsGenerate() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span
          className="font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.36em' }}
        >
          two surfaces, one product
        </span>
        <h2 className="text-[28px] font-medium leading-tight tracking-tight">
          Interactions API vs generate_content
        </h2>
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-[var(--text-muted)]">
          Most teams reach for <code className="font-mono text-[12.5px]">client.models.generate_content</code> and
          rebuild conversation history client-side. The Interactions API
          (<code className="font-mono text-[12.5px]">previous_interaction_id</code>) is the stateful alternative —
          server-side context, simpler client code, different failure modes.
          Read this before deciding which to bet on.
        </p>
      </header>
      <Panel pad={false} className="overflow-x-auto">
        <table className="min-w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
              <th
                className="px-5 py-3 text-left font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.18em' }}
              >
                axis
              </th>
              <th
                className="px-5 py-3 text-left font-mono text-[10.5px] uppercase text-[var(--text-subtle)]"
                style={{ letterSpacing: '0.18em' }}
              >
                generate_content
              </th>
              <th
                className="px-5 py-3 text-left font-mono text-[10.5px] uppercase text-[var(--accent)]"
                style={{ letterSpacing: '0.18em' }}
              >
                Interactions API
              </th>
            </tr>
          </thead>
          <tbody>
            {INTERACTIONS_VS_GENERATE.map((row, i) => (
              <tr
                key={row.axis}
                className={i % 2 === 1 ? 'bg-[var(--surface-raised)]/40' : ''}
              >
                <td className="px-5 py-4 align-top">
                  <span className="font-medium text-[13px] text-[var(--text)]">{row.axis}</span>
                </td>
                <td className="px-5 py-4 align-top text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  {row.generate_content}
                </td>
                <td className="px-5 py-4 align-top text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  {row.interactions}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      {INTERACTIONS_VS_GENERATE.some((r) => r.takeaway) && (
        <div className="grid gap-3 md:grid-cols-2">
          {INTERACTIONS_VS_GENERATE.filter((r) => r.takeaway).map((r) => (
            <Panel key={r.axis}>
              <span
                className="font-mono text-[10.5px] uppercase text-[var(--accent)]"
                style={{ letterSpacing: '0.28em' }}
              >
                takeaway · {r.axis}
              </span>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text)]">{r.takeaway}</p>
            </Panel>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 text-[11px] text-[var(--text-subtle)]">
        <span className="font-mono uppercase" style={{ letterSpacing: '0.18em' }}>
          source
        </span>
        <a
          href={INTERACTIONS_SOURCE.url}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--text-muted)] underline-offset-4 hover:text-[var(--text)] hover:underline"
        >
          {INTERACTIONS_SOURCE.label}
        </a>
        <span aria-hidden>·</span>
        <span className="font-mono numeric">as of {ACCESSED}</span>
      </div>
    </div>
  )
}
