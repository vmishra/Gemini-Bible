/**
 * SessionSpendRibbon — small pill at the top-right of the /tune page.
 *
 * Cumulative USD across all tunes since page load. Hover reveals a
 * breakdown of the last 5 tunes (timestamp + per-tune cost + model +
 * AB flag). Reset on page reload — no localStorage in v1, intentional
 * (keeps the page stateless across sessions).
 */

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

import { useTune } from '../../state/tune'

export function SessionSpendRibbon() {
  const total = useTune((s) => s.sessionSpendUsd)
  const history = useTune((s) => s.spendHistory)
  const reduced = useReducedMotion()

  // Microbounce when total changes (after the first non-zero value).
  const [bounce, setBounce] = useState(0)
  const prevTotal = useRef(total)
  useEffect(() => {
    if (total !== prevTotal.current && total > 0) {
      setBounce((n) => n + 1)
    }
    prevTotal.current = total
  }, [total])

  if (total === 0) return null

  return (
    <div className="group relative">
      <motion.div
        key={bounce}
        initial={reduced ? false : { scale: 1 }}
        animate={reduced ? { scale: 1 } : { scale: [1, 1.06, 1] }}
        transition={{ duration: reduced ? 0 : 0.35, ease: 'easeOut' }}
        className="rounded-full border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 font-mono text-[11px] text-[var(--text-muted)]"
        style={{ boxShadow: 'var(--shadow-1)' }}
      >
        <span className="text-[var(--text-subtle)]">session · </span>
        <span className="text-[var(--text)]">{fmtUsd(total)}</span>
      </motion.div>

      {/* Hover reveal — last 5 tunes */}
      <div
        className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-[260px] origin-top-right scale-95 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-raised)] p-3 opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
        style={{ boxShadow: 'var(--shadow-2, var(--shadow-1))' }}
      >
        <div
          className="mb-2 font-mono text-[9.5px] uppercase text-[var(--text-subtle)]"
          style={{ letterSpacing: '0.32em' }}
        >
          last {Math.min(history.length, 5)} tune{history.length === 1 ? '' : 's'}
        </div>
        <ul className="flex flex-col gap-1.5">
          {history.slice(-5).reverse().map((entry, i) => (
            <li
              key={`${entry.timestamp}-${i}`}
              className="flex items-baseline justify-between gap-2 font-mono text-[10.5px] text-[var(--text-muted)]"
            >
              <span className="truncate">
                {entry.model.replace('gemini-', '')}
                {entry.ran_ab ? ' + judge' : ''}
              </span>
              <span className="text-[var(--text)]">{fmtUsd(entry.usd)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-[var(--text-subtle)]">
          Resets on page reload. No localStorage.
        </p>
      </div>
    </div>
  )
}

function fmtUsd(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}
