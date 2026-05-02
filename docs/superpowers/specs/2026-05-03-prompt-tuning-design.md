# Prompt Tuning Module — Design

Status: approved (brainstorming)
Date: 2026-05-03
Owner: Vikas Mishra
Phase: B1 (of four-phase advanced-features rollout: sample sweep → prompt
tuning → code converter → background refresh agent)

## Goal

A new `/tune` route that takes a user's text prompt + target Gemini model
and produces a *surgical, annotated diff* — each hunk citing a rule from
a structured best-practices catalog. Optional opt-in step runs both
prompts against the target model and a judge model attributes
win/loss/no-change to each cited rule. The user gets concrete,
model-specific guidance grounded in official docs.

## Non-goals (this phase)

- system_instruction / tool-schema / response_schema tuning — text prompt
  only.
- Multimodal prompt tuning — niche; the image best-practices guide is
  already a static page.
- Saved tunings, history, or "starred" prompts — no persistence layer.
- Iterative chat-style tuning loop — single shot per click; user re-runs
  to iterate.
- Cross-model "should I switch from Pro to Flash?" comparison — same
  target model on both sides of the A/B.
- A new shared "AI helper" backend abstraction — Phase B2 (Code
  Converter) will share patterns; the abstraction emerges then, not
  preemptively.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | What does "tune" do? | B — surgical diff with rule-annotated hunks |
| 2 | Catalog location & format | A — YAML at `backend/practices/*.yaml`, one file per source URL |
| 3 | Run-and-judge default | D — diff-only by default; opt-in toggle to run A/B + judge |
| 4 | Judge output shape | C — per-rule attribution (the diff's rules become the rubric); cap diff at 5 rules per pass |
| 5 | Tuner & judge models | C — Tuner = target model; Judge = `gemini-3.1-pro-preview`; expert override via query string |
| 6 | Cost guardrails | B + D + A — pre-flight estimate + session-spend ribbon + per-leg `max_output_tokens` caps |
| 7 | Tunable input scope | A — text prompt only |
| 8 | UI shape | A — single-column scroll, collapsed hunks, tabbed result section |

## Best-practices catalog (the foundation)

### Location

`backend/practices/*.yaml` — one file per source URL. Initial set:

```
backend/practices/
  prompting-3x.yaml             # Gemini 3 prompting strategies
  prompting-2x.yaml             # legacy 2.5 patterns (different idiom)
  image-generation.yaml         # Nano Banana / image best-practices
  live-api.yaml                 # bidi session patterns
  multi-turn-chat.yaml          # chat session patterns
  structured-output.yaml        # JSON / schema patterns
```

### Schema

Validated at startup with Pydantic.

```yaml
# backend/practices/prompting-3x.yaml
source:
  url: https://ai.google.dev/gemini-api/docs/gemini-3#prompting_best_practices
  label: "Gemini 3 Developer Guide — Prompting best practices"
  as_of: "2026-04-30"

applies_to:
  model_families: ["gemini-3"]      # model id prefixes; tuner filters by this

rules:
  - id: temperature-default          # stable; cited by diff hunks
    title: "Default temperature 1.0"
    rule: "Keep temperature at the default value of 1.0."
    quote: '"changing it may cause performance degradation"'
    why: "Gemini 3 is calibrated for T=1.0. Forcing T=0 hurts reasoning and tool selection."
    applies_when: "config.temperature is set non-default"
    severity: blocking                # blocking | recommended | informational
  - id: be-terse-not-persuasive
    title: "Be precise, not elaborate"
    rule: "Be concise. Direct, clear instructions only."
    quote: '"Verbose or overly complex prompt engineering" makes Gemini 3 over-analyze.'
    why: "Old 2.x prompt-engineering tricks now cost quality."
    applies_when: "prompt contains motivational/persuasive language ('you are an expert who…')"
    severity: recommended
  # …
```

`applies_when` is **plain English** for the tuner LLM to interpret —
not a structured DSL. We keep judgement in the model where it belongs.

### Loader (`backend/app/practices.py`)

```python
def rules_for_model(model: str) -> list[Rule]:
    """Filter rules by the target model's family prefix."""

def rule_by_id(anchor: str) -> Rule | None:
    """Look up by '<file>#<id>' anchor — used by diff hunks for citation resolution."""
```

YAML files are loaded once at app startup; reload via process restart.

### API

- `GET /api/practices` — full catalog dump.
- `GET /api/practices?model=gemini-3-flash-preview` — filtered subset
  (what the tuner sees per call).

### Migration of existing `PRACTICE_SECTIONS`

One commit ports the existing TS content into the YAML files, generating
IDs from rule titles (slugified). The frontend `Practices.tsx` page
keeps reading the TS constant for now — switching it to consume
`/api/practices` is a follow-up, not Phase B1 scope.

## Backend pipeline

### `POST /api/tune`

```python
class TuneRequest(BaseModel):
    prompt: str                          # the text to tune
    target_model: str                    # e.g. "gemini-3-flash-preview"
    run_ab: bool = False                 # opt-in A/B + judge
    tuner_model: str | None = None       # expert override; defaults to target_model
    judge_model: str | None = None       # expert override; defaults to "gemini-3.1-pro-preview"


class DiffHunk(BaseModel):
    op: Literal["replace", "insert", "delete"]
    before: str | None                   # span being replaced/deleted
    after: str | None                    # replacement text
    rule_anchor: str                     # "prompting-3x#be-terse-not-persuasive"
    rationale: str                       # one paragraph; tuner-authored
    quote: str                           # verbatim from the catalog


class TuneResponse(BaseModel):
    original: str
    tuned: str
    hunks: list[DiffHunk]                # max 5 (cap)
    rules_considered: list[str]          # anchor IDs the tuner had access to
    cost_estimate_usd: float             # actual spend on the tune call
    tuner_metrics: dict                  # TurnMetrics shape (from metrics.py)
    ab: ABResult | None = None
```

### Tuner pipeline

One structured-output call:

1. Load `rules_for_model(target_model)` from the catalog.
2. Build a single `generate_content` call to `tuner_model` with:
   - `system_instruction` describing the tuner's job ("you are a prompt
     linter; output ≤5 hunks").
   - `response_json_schema` = `TunerResponse` (the diff hunk list).
   - `temperature=0.2` (lower for structural consistency, same rationale
     as `text/structured-output`).
   - Contents: the user's prompt + the filtered rule catalog as a JSON
     block.
3. Parse the structured response, validate every `rule_anchor` resolves
   to a real catalog entry. Hallucinated anchors → 422.
4. Apply the hunks deterministically on the backend to produce `tuned`.
   The tuner does not return the final string — only the hunks. This
   prevents the model from sneaking in content not justified by the
   catalog.

### A/B + judge pipeline (only when `run_ab=True`)

```python
class RuleVerdict(BaseModel):
    rule_anchor: str
    verdict: Literal["helped", "hurt", "no_change", "unclear"]
    reasoning: str
    evidence_quote_original: str | None
    evidence_quote_tuned: str | None


class ABResult(BaseModel):
    original_output: str
    tuned_output: str
    original_metrics: dict               # TurnMetrics
    tuned_metrics: dict
    overall_winner: Literal["original", "tuned", "tie"]
    overall_reasoning: str
    per_rule: list[RuleVerdict]          # one entry per applied hunk's rule
    cost_estimate_usd: float             # total: both runs + judge
```

Steps:

1. Pre-flight `count_tokens` for the original and tuned prompts; compute
   the estimate against the rate card. Fail-loudly if the estimate
   exceeds **a hard ceiling of $1.00 per single tune** (env-overridable
   via `TUNE_MAX_USD`) — surface as 413.
2. Fan out two parallel `generate_content` calls on `target_model` —
   original and tuned — with `max_output_tokens=2000` capped.
3. One structured-output call on `judge_model` with both outputs, the
   diff hunks, and the per-rule rubric — returns `ABResult` shape
   directly.
4. Per-leg metrics fold into the response so the frontend ribbon shows
   the same `tokens / time / $` triple it shows for samples.

### `POST /api/tune/estimate`

Same body as `/api/tune` but returns only the cost-estimate breakdown
(no model calls). Used by the form to update the price preview as the
user types.

### No shared "AI helper" abstraction yet

Phase B2 (Code Converter) needs the same pattern (call Gemini with
structured output + rationale + cost telemetry). Deliberately skip the
abstraction during Phase B1 — wait until two concrete consumers exist
before factoring. Premature abstraction would force one design to fit
both.

## Frontend

### Route

New top-level `/tune` page, fifth tab in the header alongside Home /
Practices / Calculator / Samples. Routes are zustand-driven via the
existing `useRoute` store.

### Files

```
frontend/src/routes/Tune.tsx              # page shell, form, result orchestration
frontend/src/state/tune.ts                # zustand store
frontend/src/components/tune/
  TuneForm.tsx                            # textarea + model picker + A/B toggle + cost preview
  DiffPanel.tsx                           # collapsed-by-default hunks with rule citations
  ABResultPanel.tsx                       # tabs: Outputs | Per-rule verdict | Overall
  CostPreview.tsx                         # live "≈ $X.XX" beside the Tune button
  SessionSpendRibbon.tsx                  # cumulative spend across the session
```

### TuneForm

- Prompt textarea — Monaco editor (consistency with `/samples`).
- Target model picker — reuse the model selector from `/samples`. Filter
  to text-capable models (no Veo / Imagen / TTS / embeddings).
- A/B toggle — single switch, label "Run A/B comparison + judge". Off by
  default.
- Cost preview — debounced 400ms call to `/api/tune/estimate` as the
  user types. Two lines: "Tune only — $X.XX" and "+ A/B + judge —
  $Y.YY" (visible only when toggle is on).
- Tune button — disabled while in flight; label echoes the active model
  + cost so the user always sees what they're committing to.

### DiffPanel

- Each hunk renders as a collapsed bar by default: rule title + severity
  dot + "show change" affordance.
- Expanded hunk shows: red/green inline before/after, italic catalog
  quote, the tuner's rationale paragraph, an anchor link to the source
  URL.
- Top of panel: "5 changes from 3 rules · 2 blocking, 3 recommended" +
  a Copy tuned prompt button.

### ABResultPanel (renders only when A/B run completed)

- Three tabs: Verdict (default), Outputs, Metrics.
- Verdict — overall winner header + per-rule rows (rule title +
  helped/hurt/no-change pill + judge's evidence quotes).
- Outputs — side-by-side scrollable read-only Monaco editors.
- Metrics — token / time / $ triple per leg + judge.

### State (zustand)

```typescript
type TuneState = {
  // form
  prompt: string
  targetModel: string
  runAB: boolean
  // result
  status: 'idle' | 'estimating' | 'tuning' | 'done' | 'error'
  result: TuneResponse | null
  error: string | null
  // session telemetry
  sessionSpendUsd: number             // cumulative this session
  recordSpend: (usd: number) => void
}
```

### Session-spend ribbon

Fixed-position pill at the page-top-right (only on `/tune`), showing
`$0.12 spent this session`. Hover shows breakdown of the last 5 tunes.
Reset on page reload — no localStorage in v1.

### Design language

Reuses the existing OKLCH dark-first theme, Geist Mono for code,
accent-hairline borders for emphasis. No new visual primitives. Diff
colouring uses existing semantic tokens (`--accent-soft` for additions,
muted strikethrough for deletions).

### Animation

- Subtle stagger on diff hunks (50ms per item; respects
  `prefers-reduced-motion`).
- Session-spend pill micro-bounce when it changes.
- No giant transitions — the slide hairline-sweep is overkill for a
  working page.

## Testing

Mock-only — no real API calls.

### Backend

```
backend/tests/
  test_practices_catalog.py     # YAML loads, schema valid, anchor IDs unique
  test_tune_endpoint.py         # /api/tune happy path, opt-in A/B, error cases
  test_tune_estimate.py         # cost math against the rate card
  test_tune_diff_apply.py       # hunks apply deterministically to produce tuned string
```

Catalog tests cover: every YAML parses + validates, anchor IDs unique
within file, `rules_for_model` filters by family prefix correctly,
`rule_by_id` resolves.

Tune endpoint tests reuse the `mock_client` fixture from Phase A. The
mock gets a small extension: when `generate_content` is called with a
`response_json_schema`, return canned JSON that matches the schema (a
fixture per call site — tuner response, judge response). Coverage:
happy path (no AB), opt-in AB, hallucinated rule_anchor → 422, hard
ceiling → 413, per-leg `max_output_tokens` caps verified.

Diff-apply tests are pure-function tests. Given a `before/after/op`
list against a known `original`, asserts the reconstructed `tuned` is
byte-exact. Edge cases: overlapping hunks (rejected), out-of-order
hunks (sorted before apply), empty `before` (insert).

Cost estimate tests verify the math against `metrics.py`'s rate card
for known fixtures, exercising the long-context tier crossover at 200K
tokens.

### Frontend

Manual verification only — the project doesn't yet have a frontend
test runner, and adding one is scope creep:

- Page loads at `/tune` after route registration.
- Form submission triggers the right API calls.
- Diff panel renders collapsed; expand works; rule citations link.
- Cost preview updates within 500ms of typing.
- A/B toggle on/off updates preview without re-fetching.

### Coverage target

~30 backend tests on top of Phase A's 84 — ~110 total in <5s.

## Migration plan

Same "max commits" cadence as Phase A — each commit passes tests, each
commit pushed.

| # | Group | Commits | What lands |
|---|---|---|---|
| 1 | Catalog foundation | 5 | YAML schema (Pydantic), 4-5 catalog files ported from `PRACTICE_SECTIONS`, loader + tests |
| 2 | `/api/practices` endpoint | 2 | endpoint + tests |
| 3 | Tune diff-apply primitive | 2 | pure-function applier + tests |
| 4 | Cost estimate | 2 | `count_tokens`-based estimator + tests |
| 5 | Tuner pipeline | 3 | tuner system prompt, structured-output call, response validation; mock-extension; tests |
| 6 | Judge pipeline | 3 | judge system prompt, per-rule rubric synthesis, judge call; tests |
| 7 | `/api/tune` endpoint | 3 | request/response models, fan-out, error mapping; happy + edge tests |
| 8 | `/api/tune/estimate` endpoint | 1 | trivial wrapper around estimator |
| 9 | Frontend route + zustand store | 2 | `/tune` route, store, header tab entry |
| 10 | Frontend `TuneForm` | 2 | form, model picker reuse, debounced cost preview |
| 11 | Frontend `DiffPanel` | 3 | rendering, collapse/expand, copy button |
| 12 | Frontend `ABResultPanel` | 3 | tabs, side-by-side outputs, per-rule verdict list |
| 13 | Frontend `SessionSpendRibbon` | 1 | small fixed-position pill |
| 14 | Visual polish | 1 | stagger animation on hunks, microbounce on ribbon |

**33 commits** total, each pushed to `origin/main`.

### Order rationale

1. Catalog before everything else — data contract every other piece
   depends on.
2. Diff-apply primitive and cost estimate are pure functions — easy to
   land and test in isolation.
3. Tuner before judge — judge depends on tuner output shape.
4. Both endpoints before any frontend — frontend can hit live endpoints
   during dev.
5. Frontend route + form first, then results panels in order of how
   often they appear (DiffPanel always; ABResultPanel only when opted
   in).
6. Visual polish last — easier to tune motion against real, populated
   panels.

### Definition of done per commit

1. Tests green (`pytest backend/tests/`).
2. `ruff check backend/` clean.
3. Frontend `npx tsc --noEmit` clean (when frontend touched).
4. Pushed to `origin/main`.
5. App still runs end-to-end via `./app.sh restart` (manual sanity
   check on the few wiring commits).

## Risks

- **YAML drift from official docs.** The catalog is a frozen snapshot
  of best practices that evolve. Phase C (Background Refresh Agent)
  will mutate this catalog, but until then it's manually maintained.
  The `as_of` field per file is the staleness signal.
- **Tuner LLM hallucinating `applies_when`.** The tuner reads the
  plain-English `applies_when` heuristic and decides whether a rule
  fires. It can be wrong. Mitigations: structured-output schema forces
  a `rule_anchor` from the loaded catalog (no inventing rules); judge
  step (when opted in) catches false positives by scoring the rule's
  per-prompt impact.
- **Diff-apply edge cases.** Overlapping hunks, hunks against text the
  user simultaneously edited (rare since this is a one-shot form), and
  unicode boundary issues are the main risks. Tests cover the first
  two; unicode is bounded by Python's native string slicing semantics.
- **Cost ceiling false-positives.** A long-prompt tune with
  conservative sampling could estimate > $1.00 even when the actual
  spend would be under. The 413 error message includes the breakdown
  and an env-var override hint; users with genuine need can raise the
  ceiling.

## What lands at the end

- A new `/tune` route that produces annotated, citation-grounded prompt
  rewrites against the user's chosen target model.
- Backend YAML catalog of best practices, ready for Phase B2 (Code
  Converter) and Phase C (Background Refresh Agent) to reuse and
  mutate.
- Cost-aware UX: pre-flight estimate + opt-in A/B + per-session spend
  ribbon. No surprise bills.
- ~30 mock backend tests on top of Phase A's 84 — ~110 total in <5s.
- Foundation for Phase B2 (Code Converter), which will share the
  structured-output + cost-telemetry + judge-style verification
  patterns this phase pioneers.
