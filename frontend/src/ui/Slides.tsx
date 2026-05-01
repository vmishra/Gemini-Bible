import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from './cn'

// The slide deck owns its own scroll container — `overflow-y-auto` on a flex
// child of <main>, not the document. Inner motion components (whileInView,
// useInView) need to observe THAT container, not the document viewport, or
// IntersectionObserver triggers fire all at once on mount instead of as the
// reader scrolls into each slide. We expose the container ref through context
// so any descendant can use it as the IntersectionObserver root.
const ScrollContainerContext = createContext<RefObject<HTMLElement> | null>(null)

export function useSlideScrollRoot(): RefObject<HTMLElement> | null {
  return useContext(ScrollContainerContext)
}

/**
 * Slide deck UX — turns a long scroll page into a paged, keyboard-navigated
 * presentation while keeping the section content untouched.
 *
 *   <SlideShell>
 *     <Slide id="hero" name="Built on Google × Gemini">…</Slide>
 *     <Slide id="picker" name="Decision picker">…</Slide>
 *     …
 *   </SlideShell>
 *
 * Wrap each top-level section in a <Slide>. The shell handles:
 *   - CSS scroll-snap (proximity, so mouse-wheel still feels natural)
 *   - keyboard navigation: ↓ ↑ PgDn PgUp Space Shift+Space Home End
 *   - active-slide tracking via IntersectionObserver
 *   - right-edge rail with one dot per slide (clickable)
 *   - top-right counter "03 / 18"
 *   - first-time hint that fades after the user navigates
 *
 * Long sections still scroll naturally — snap is `proximity` not `mandatory`,
 * so a slide taller than the viewport is fully reachable.
 */

type SlideMeta = { id: string; name: string }

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (TYPING_TAGS.has(target.tagName)) return true
  if (target.isContentEditable) return true
  // Monaco renders into a div with role="code" and contenteditable; both caught above.
  // Don't capture keys when focus is anywhere inside an editor surface.
  if (target.closest('.monaco-editor')) return true
  return false
}

export function SlideShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [slides, setSlides] = useState<SlideMeta[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [hasNavigated, setHasNavigated] = useState(false)

  // Enumerate slides on mount and whenever children change. We trigger
  // a re-scan on a microtask so refs settle.
  useEffect(() => {
    if (!ref.current) return
    const els = Array.from(ref.current.querySelectorAll<HTMLElement>('[data-slide]'))
    const next = els.map((el) => ({ id: el.id, name: el.dataset.name ?? '' }))
    setSlides(next)
  }, [children])

  // Track which slide intersects the viewport center.
  useEffect(() => {
    if (!ref.current || slides.length === 0) return
    const root = ref.current
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).id
          const idx = slides.findIndex((s) => s.id === id)
          if (idx >= 0) setActiveIndex(idx)
        }
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    )
    slides.forEach((s) => {
      const el = root.querySelector(`#${CSS.escape(s.id)}`)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [slides])

  const goTo = useCallback(
    (idx: number) => {
      if (!ref.current) return
      const clamped = Math.max(0, Math.min(slides.length - 1, idx))
      const el = ref.current.querySelector<HTMLElement>(`#${CSS.escape(slides[clamped].id)}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setHasNavigated(true)
      }
    },
    [slides],
  )

  // Keyboard navigation.
  useEffect(() => {
    if (slides.length === 0) return
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return
      const idx = activeIndex
      let next: number | null = null
      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
          next = idx + 1
          break
        case 'ArrowUp':
        case 'PageUp':
          next = idx - 1
          break
        case ' ':
          next = e.shiftKey ? idx - 1 : idx + 1
          break
        case 'Home':
          next = 0
          break
        case 'End':
          next = slides.length - 1
          break
        default:
          return
      }
      if (next == null) return
      e.preventDefault()
      goTo(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeIndex, slides.length, goTo])

  return (
    <ScrollContainerContext.Provider value={ref as RefObject<HTMLElement>}>
      <div className="relative flex flex-1 overflow-hidden">
        <div
          ref={ref}
          className="relative flex-1 overflow-y-auto"
          style={{
            scrollBehavior: 'smooth',
            scrollSnapType: 'y proximity',
          }}
        >
          {children}
        </div>

        {slides.length > 0 && (
          <>
            <SlideRail slides={slides} activeIndex={activeIndex} onJump={goTo} />
            <SlideCounter index={activeIndex} total={slides.length} />
            <SlideHint visible={!hasNavigated && slides.length > 1} />
          </>
        )}
      </div>
    </ScrollContainerContext.Provider>
  )
}

export function Slide({
  id,
  name,
  children,
  full = true,
  className,
}: {
  id: string
  name: string
  children: ReactNode
  full?: boolean
  className?: string
}) {
  const prefersReducedMotion = useReducedMotion()
  const root = useSlideScrollRoot()
  return (
    <section
      data-slide
      data-name={name}
      id={id}
      className={cn(
        'flex flex-col justify-start px-10 py-16',
        full ? 'min-h-screen' : '',
        className,
      )}
      style={{ scrollSnapAlign: 'start' }}
    >
      {prefersReducedMotion ? (
        children
      ) : (
        <motion.div
          // Each slide fades up + slides in as it enters the deck's scroll
          // container (NOT the document viewport — see ScrollContainerContext).
          // Plays once per mount so back-and-forth nav doesn't retrigger.
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{
            once: true,
            amount: 0.2,
            root: (root ?? undefined) as React.RefObject<Element> | undefined,
          }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        >
          {children}
        </motion.div>
      )}
    </section>
  )
}

function SlideRail({
  slides,
  activeIndex,
  onJump,
}: {
  slides: SlideMeta[]
  activeIndex: number
  onJump: (idx: number) => void
}) {
  return (
    <nav
      aria-label="slide navigation"
      className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden items-center px-4 lg:flex"
    >
      <ul className="pointer-events-auto flex flex-col gap-2.5">
        {slides.map((s, i) => {
          const active = i === activeIndex
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-label={`go to slide ${i + 1}: ${s.name}`}
                onClick={() => onJump(i)}
                className="group relative flex h-3 w-3 items-center justify-center"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-all',
                    active
                      ? 'bg-[var(--accent)] scale-150'
                      : 'bg-[var(--text-subtle)] group-hover:bg-[var(--text-muted)]',
                  )}
                />
                <span
                  className={cn(
                    'pointer-events-none absolute right-5 hidden whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--elev-2)] px-2.5 py-1.5',
                    'text-[11.5px] text-[var(--text)] shadow-[var(--shadow-1)]',
                    'group-hover:block',
                  )}
                >
                  <span
                    className="numeric mr-2 font-mono text-[10px] text-[var(--text-subtle)]"
                    style={{ letterSpacing: '0.18em' }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.name}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function SlideCounter({ index, total }: { index: number; total: number }) {
  return (
    <div className="pointer-events-none absolute right-5 top-4 z-30 flex items-baseline gap-1.5">
      <span
        className="numeric font-mono text-[12px] text-[var(--text)]"
        style={{ letterSpacing: '0.06em' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="font-mono text-[10px] text-[var(--text-subtle)]">
        / {String(total).padStart(2, '0')}
      </span>
    </div>
  )
}

function SlideHint({ visible }: { visible: boolean }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 transform',
        'flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)]/90 px-3 py-1.5',
        'backdrop-blur-sm transition-opacity duration-500',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <ArrowDownIcon />
      <span
        className="font-mono text-[10.5px] uppercase text-[var(--text-muted)]"
        style={{ letterSpacing: '0.28em' }}
      >
        press ↓ to advance
      </span>
    </div>
  )
}

function ArrowDownIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 3v10m0 0l-4-4m4 4l4-4"
        stroke="var(--text-muted)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Used by Home.tsx to compute slide ids deterministically.
export function slideId(name: string): string {
  return 'slide-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
