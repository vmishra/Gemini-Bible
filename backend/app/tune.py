"""Prompt-tuning primitives — diff hunk schema + deterministic apply.

The tuner LLM emits a list of DiffHunks. Each hunk is a (before, after)
pair: find `before` in the original prompt, replace it with `after`.
This is the simplest model that handles all three intents the tuner
might have:

  replace : before non-empty, after non-empty (the common case)
  insert  : before is a unique anchor span; after = anchor + new content
  delete  : after is empty, before is the span to remove

Why string-match instead of position-based? Position offsets coming back
from an LLM are notoriously unreliable — the model recounts characters
and gets it wrong on long prompts. String anchors are robust as long as
the anchor is unique (we enforce single-match-in-original).

The function is pure: same inputs → same output, no side effects, no
network. apply_hunks() lives here so /api/tune can validate that the
LLM-supplied hunks reconstruct cleanly before returning anything.
"""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

HunkOp = Literal["replace", "insert", "delete"]


class DiffHunk(BaseModel):
    """One change against the original prompt.

    `op` is metadata for display — the actual application is a uniform
    "find before, replace with after". `op` is the tuner's classification
    of what kind of change this is, and the frontend uses it to colour
    the diff.
    """

    op: HunkOp
    before: str | None = Field(
        default=None,
        description="The substring of the original to replace. Must match exactly once.",
    )
    after: str | None = Field(
        default=None,
        description="Replacement text. Empty/None means delete.",
    )
    rule_anchor: str = Field(
        ...,
        description="<file_stem>#<id> — the catalog rule that justifies this hunk.",
    )
    rationale: str = Field(
        ...,
        description="One paragraph from the tuner explaining why this rule fires here.",
    )
    quote: str = Field(
        default="",
        description="Verbatim quote from the catalog rule (loader-stamped).",
    )


class DiffApplyError(ValueError):
    """Raised when a hunk list can't be applied cleanly to the original.

    Subclass of ValueError so /api/tune can surface as 422 with a clear
    message rather than crashing the request.
    """


def apply_hunks(original: str, hunks: list[DiffHunk]) -> str:
    """Apply a list of DiffHunks to the original prompt deterministically.

    Each hunk's `before` must match the original exactly once. Hunks may
    appear in any order in the input list; we locate them by string match
    in the original (NOT in any intermediate result) and apply in reverse
    document order so earlier indices remain valid.

    Raises DiffApplyError if:
      - a hunk has no `before`
      - a hunk's `before` is missing from the original
      - a hunk's `before` matches the original more than once
      - two hunks' spans overlap in the original
    """
    if not hunks:
        return original

    # Step 1: locate each hunk's (start, end, replacement) span in original.
    spans: list[tuple[int, int, str, str]] = []  # (start, end, after, anchor — for errors)
    for hunk in hunks:
        if not hunk.before:
            raise DiffApplyError(
                f"hunk {hunk.rule_anchor}: `before` is required (use a unique "
                "anchor span for inserts and put the anchor in `after` too)"
            )
        first = original.find(hunk.before)
        if first == -1:
            preview = (hunk.before[:60] + "…") if len(hunk.before) > 60 else hunk.before
            raise DiffApplyError(
                f"hunk {hunk.rule_anchor}: `before` not found in original — {preview!r}"
            )
        if original.find(hunk.before, first + 1) != -1:
            preview = (hunk.before[:60] + "…") if len(hunk.before) > 60 else hunk.before
            raise DiffApplyError(
                f"hunk {hunk.rule_anchor}: `before` matches multiple times — "
                f"need a unique anchor span. Got {preview!r}"
            )
        spans.append((first, first + len(hunk.before), hunk.after or "", hunk.rule_anchor))

    # Step 2: detect overlapping spans.
    spans.sort(key=lambda s: s[0])
    for i in range(len(spans) - 1):
        a_end = spans[i][1]
        b_start = spans[i + 1][0]
        if a_end > b_start:
            raise DiffApplyError(
                f"hunks {spans[i][3]} and {spans[i + 1][3]} have overlapping `before` "
                f"spans in the original — tuner must produce non-overlapping hunks"
            )

    # Step 3: apply in reverse document order.
    out = original
    for start, end, after, _ in reversed(spans):
        out = out[:start] + after + out[end:]
    return out


# ---------------------------------------------------------------------------
# Cost estimate
# ---------------------------------------------------------------------------

# Per-leg max output tokens (also enforced at request time on the SDK call).
TUNER_MAX_OUTPUT = 2000
TARGET_MAX_OUTPUT = 2000
JUDGE_MAX_OUTPUT = 1500

# Default judge model when the caller doesn't override.
DEFAULT_JUDGE_MODEL = "gemini-3.1-pro-preview"


def _approx_tokens(text: str) -> int:
    """Heuristic token count: ~1 token per 4 characters of English text.

    Used by the cost estimator so it can run without a network round-trip
    on every keystroke. Real per-call accounting uses the SDK's
    usage_metadata, which is exact.
    """
    return max(len(text) // 4, 1) if text else 0


class CostLeg(BaseModel):
    """One leg of the cost estimate breakdown."""
    label: str                            # e.g. "tuner", "target original", "judge"
    model: str
    input_tokens: int
    output_tokens_max: int                # cap, not actual; we pre-bound the LLM
    usd: float


class CostEstimate(BaseModel):
    legs: list[CostLeg]
    total_usd: float
    run_ab: bool                          # echoes the request flag
    notes: list[str] = Field(default_factory=list)


def _leg_cost(model: str, input_tokens: int, output_tokens_max: int) -> tuple[float, str | None]:
    """Compute one leg's USD against the rate card. Returns (usd, note)."""
    from .metrics import _price_of

    rate = _price_of(model)
    if rate is None:
        return 0.0, f"no rate-card entry for {model!r}; cost shown as $0.00"

    # Long-context tier crossover. For estimate purposes, apply tier-2 rates
    # to the WHOLE prompt when it crosses the threshold (matches what the
    # billing system does — there's no proration, the whole call gets tier-2).
    is_long = (
        rate.long_context_threshold_tokens is not None
        and input_tokens > rate.long_context_threshold_tokens
    )
    in_rate = (
        rate.long_context_input_per_mtok or rate.input_per_mtok
        if is_long
        else rate.input_per_mtok
    )
    out_rate = (
        rate.long_context_output_per_mtok or rate.output_per_mtok
        if is_long
        else rate.output_per_mtok
    )

    usd = (input_tokens * in_rate + output_tokens_max * out_rate) / 1_000_000
    return usd, None


def estimate_cost(
    *,
    prompt: str,
    target_model: str,
    run_ab: bool = False,
    tuner_model: str | None = None,
    judge_model: str | None = None,
    catalog_size_chars: int = 4000,        # rough size of the rule catalog appended to tuner input
    tuned_overhead_chars: int = 200,       # rough size of the diff metadata returned
) -> CostEstimate:
    """Pre-flight cost estimate for a /api/tune call.

    Inputs are estimated via a 1-token-per-4-chars heuristic so the
    estimator runs without a network round-trip. Per-leg `output_tokens_max`
    is the SDK-enforced cap, not the expected actual — gives an upper-bound
    estimate, which is the right side to err on for a pre-flight.

    The catalog_size_chars and tuned_overhead_chars defaults are tuned to
    the current catalog (4 files, ~18 rules ≈ 4 KB serialised).
    """
    tuner = tuner_model or target_model
    judge = judge_model or DEFAULT_JUDGE_MODEL

    legs: list[CostLeg] = []
    notes: list[str] = []

    # Tuner sees the prompt + the filtered rule catalog. Output is the diff JSON.
    tuner_input = _approx_tokens(prompt) + _approx_tokens("x" * catalog_size_chars)
    tuner_usd, note = _leg_cost(tuner, tuner_input, TUNER_MAX_OUTPUT)
    if note:
        notes.append(note)
    legs.append(CostLeg(
        label="tuner",
        model=tuner,
        input_tokens=tuner_input,
        output_tokens_max=TUNER_MAX_OUTPUT,
        usd=tuner_usd,
    ))

    if run_ab:
        # Two target runs: original and tuned. Tuned input ≈ original + diff overhead.
        original_in = _approx_tokens(prompt)
        tuned_in = original_in + _approx_tokens("x" * tuned_overhead_chars)

        for label, in_toks in (("target · original", original_in), ("target · tuned", tuned_in)):
            usd, note = _leg_cost(target_model, in_toks, TARGET_MAX_OUTPUT)
            if note:
                notes.append(note)
            legs.append(CostLeg(
                label=label,
                model=target_model,
                input_tokens=in_toks,
                output_tokens_max=TARGET_MAX_OUTPUT,
                usd=usd,
            ))

        # Judge sees both outputs (cap × 2) plus the diff hunks (~500 chars).
        judge_in = TARGET_MAX_OUTPUT * 2 + _approx_tokens("x" * 500)
        judge_usd, note = _leg_cost(judge, judge_in, JUDGE_MAX_OUTPUT)
        if note:
            notes.append(note)
        legs.append(CostLeg(
            label="judge",
            model=judge,
            input_tokens=judge_in,
            output_tokens_max=JUDGE_MAX_OUTPUT,
            usd=judge_usd,
        ))

    total = sum(leg.usd for leg in legs)
    return CostEstimate(legs=legs, total_usd=total, run_ab=run_ab, notes=notes)


# ---------------------------------------------------------------------------
# Tuner pipeline
# ---------------------------------------------------------------------------

# Hard cap on hunks per tune — keeps the diff readable and bounds the
# downstream judge cost (judge scores each rule independently).
MAX_HUNKS_PER_TUNE = 5


class TunerResponse(BaseModel):
    """The structured-output schema we hand to the tuner LLM."""
    hunks: list[DiffHunk] = Field(
        ...,
        max_length=MAX_HUNKS_PER_TUNE,
        description=f"At most {MAX_HUNKS_PER_TUNE} surgical edits to the original prompt.",
    )


class TuneResult(BaseModel):
    """End-to-end result of the tuner pipeline (without the optional A/B step)."""
    original: str
    tuned: str
    hunks: list[DiffHunk]
    rules_considered: list[str]            # anchor IDs the tuner had access to


TUNER_SYSTEM_INSTRUCTION = """\
You are a prompt linter for Gemini models. Your job is to apply a curated
set of best-practice RULES to a user's prompt and emit ≤5 surgical edits.

You will receive:
  - the user's PROMPT (the input to lint)
  - a JSON list of RULES, each with id, title, rule, why, applies_when

For each rule whose `applies_when` heuristic actually fires for this
prompt, emit ONE DiffHunk with:
  - op: "replace" | "insert" | "delete"
  - before: a UNIQUE substring of the original prompt to anchor the edit
            (must appear EXACTLY ONCE in the original)
  - after: the replacement text (use the empty string for delete; for
            insert, set `before` to a unique anchor span and put that
            anchor inside `after` so the result preserves it)
  - rule_anchor: the rule's `<file_stem>#<id>` (verbatim from the rules list)
  - rationale: ONE paragraph explaining why this rule fires here

Hard rules:
  - Output AT MOST 5 hunks. Pick the highest-impact ones first.
  - Hunks must NOT overlap each other in the original prompt.
  - `before` must match the original exactly once. If you can't find a
    unique anchor, skip the rule rather than guessing.
  - Only cite rule_anchors from the supplied list. Do not invent rules.
  - Do NOT rewrite the whole prompt. The point is targeted, justified
    edits — not a from-scratch rewrite.

If the prompt is already well-formed for the target model, return an
empty hunks list. That is a valid, expected outcome.
"""


class TunerCallError(Exception):
    """Raised when the tuner's structured response is unusable."""


def _build_tuner_payload(prompt: str, rules: list) -> str:
    """Construct the user-message payload the tuner sees: the prompt plus a
    JSON-serialised view of the applicable rules."""
    rules_view = [
        {
            "anchor": r.anchor,
            "title": r.title,
            "rule": r.rule,
            "why": r.why,
            "applies_when": r.applies_when,
            "severity": r.severity,
        }
        for r in rules
    ]
    return (
        "<prompt>\n"
        f"{prompt}\n"
        "</prompt>\n\n"
        "<rules>\n"
        f"{json.dumps(rules_view, indent=2)}\n"
        "</rules>"
    )


def tune_prompt(
    *,
    prompt: str,
    target_model: str,
    tuner_model: str | None = None,
    client=None,
) -> TuneResult:
    """Run the tuner pipeline end-to-end and return a TuneResult.

    `client` is injectable for tests (defaults to genai.Client()). The
    function:
      1. Loads rules_for_model(target_model) from the catalog.
      2. Calls tuner_model with response_json_schema = TunerResponse.
      3. Validates every hunk's rule_anchor exists; stamps the catalog quote.
      4. Applies the hunks deterministically to produce `tuned`.
    """
    from . import practices

    rules = practices.rules_for_model(target_model)
    rules_considered = [r.anchor for r in rules]

    if client is None:
        from google import genai
        client = genai.Client()

    from google.genai import types as genai_types

    payload = _build_tuner_payload(prompt, rules)
    config = genai_types.GenerateContentConfig(
        system_instruction=TUNER_SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
        response_json_schema=TunerResponse.model_json_schema(),
        temperature=0.2,                       # JSON consistency, see structured-output sample
        max_output_tokens=TUNER_MAX_OUTPUT,
    )
    response = client.models.generate_content(
        model=tuner_model or target_model,
        contents=payload,
        config=config,
    )

    text = getattr(response, "text", None)
    if not text:
        raise TunerCallError("tuner returned empty response.text")

    try:
        parsed = json.loads(text)
        tuner_resp = TunerResponse.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise TunerCallError(f"tuner response is not valid TunerResponse JSON: {exc}") from exc

    # Validate + stamp catalog metadata onto each hunk.
    for hunk in tuner_resp.hunks:
        rule = practices.rule_by_id(hunk.rule_anchor)
        if rule is None:
            raise TunerCallError(
                f"tuner cited unknown rule anchor {hunk.rule_anchor!r}; "
                f"applicable rules were {rules_considered}"
            )
        hunk.quote = rule.quote

    # Apply deterministically. apply_hunks raises DiffApplyError on bad hunks
    # — let it propagate so /api/tune surfaces a clean 422.
    tuned = apply_hunks(prompt, tuner_resp.hunks)

    return TuneResult(
        original=prompt,
        tuned=tuned,
        hunks=tuner_resp.hunks,
        rules_considered=rules_considered,
    )


# ---------------------------------------------------------------------------
# A/B + judge pipeline
# ---------------------------------------------------------------------------

class RuleVerdict(BaseModel):
    rule_anchor: str
    verdict: Literal["helped", "hurt", "no_change", "unclear"]
    reasoning: str
    evidence_quote_original: str | None = None
    evidence_quote_tuned: str | None = None


class JudgeResponse(BaseModel):
    """The structured-output schema we hand to the judge LLM."""
    overall_winner: Literal["original", "tuned", "tie"]
    overall_reasoning: str
    per_rule: list[RuleVerdict]


class ABResult(BaseModel):
    original_output: str
    tuned_output: str
    overall_winner: Literal["original", "tuned", "tie"]
    overall_reasoning: str
    per_rule: list[RuleVerdict]


JUDGE_SYSTEM_INSTRUCTION = """\
You are a careful, evidence-driven judge comparing two model outputs that
came from two slightly different prompts (an ORIGINAL and a TUNED version
that applied a list of best-practice rules).

You will receive:
  - the ORIGINAL prompt and the TUNED prompt
  - both model outputs (ORIGINAL_OUTPUT, TUNED_OUTPUT)
  - the list of RULES that were applied in the tuning, each with anchor,
    title, rule, and the rationale the tuner gave for applying it

For EACH rule in the list, decide whether the change actually helped,
hurt, made no observable difference, or is unclear. Be honest — "no
change" and "unclear" are valid and expected verdicts. Your reasoning
should cite specific spans from the two outputs as evidence.

Then issue an overall verdict: did the tuned prompt produce a better
final answer, a worse one, or roughly equal?

Be terse. One paragraph per per-rule reasoning, one for overall. Cite
verbatim spans from the outputs as evidence_quote_original and
evidence_quote_tuned.
"""


class JudgeCallError(Exception):
    """Raised when the judge's structured response is unusable."""


def _build_judge_payload(
    *,
    original_prompt: str,
    tuned_prompt: str,
    original_output: str,
    tuned_output: str,
    hunks: list[DiffHunk],
) -> str:
    rules_view = [
        {
            "anchor": h.rule_anchor,
            "rule_summary": h.rationale,
            "before": h.before,
            "after": h.after,
        }
        for h in hunks
    ]
    return (
        "<original_prompt>\n"
        f"{original_prompt}\n"
        "</original_prompt>\n\n"
        "<tuned_prompt>\n"
        f"{tuned_prompt}\n"
        "</tuned_prompt>\n\n"
        "<original_output>\n"
        f"{original_output}\n"
        "</original_output>\n\n"
        "<tuned_output>\n"
        f"{tuned_output}\n"
        "</tuned_output>\n\n"
        "<applied_rules>\n"
        f"{json.dumps(rules_view, indent=2)}\n"
        "</applied_rules>"
    )


def run_ab_and_judge(
    *,
    original_prompt: str,
    tuned_prompt: str,
    hunks: list[DiffHunk],
    target_model: str,
    judge_model: str | None = None,
    client=None,
) -> ABResult:
    """Run both prompts on the target model, then ask the judge to compare.

    Three SDK calls in total:
      1. generate_content(target_model, original_prompt)
      2. generate_content(target_model, tuned_prompt)
      3. generate_content(judge_model, payload-with-both-outputs)

    The two target calls happen sequentially (not concurrently) for
    simplicity; latency is dominated by the judge call anyway.
    """
    if client is None:
        from google import genai
        client = genai.Client()

    from google.genai import types as genai_types

    # ---- Two target runs ---------------------------------------------------
    target_cfg = genai_types.GenerateContentConfig(
        max_output_tokens=TARGET_MAX_OUTPUT,
    )

    original_resp = client.models.generate_content(
        model=target_model,
        contents=original_prompt,
        config=target_cfg,
    )
    tuned_resp = client.models.generate_content(
        model=target_model,
        contents=tuned_prompt,
        config=target_cfg,
    )

    original_output = getattr(original_resp, "text", "") or ""
    tuned_output = getattr(tuned_resp, "text", "") or ""

    # ---- Judge call --------------------------------------------------------
    payload = _build_judge_payload(
        original_prompt=original_prompt,
        tuned_prompt=tuned_prompt,
        original_output=original_output,
        tuned_output=tuned_output,
        hunks=hunks,
    )
    judge_cfg = genai_types.GenerateContentConfig(
        system_instruction=JUDGE_SYSTEM_INSTRUCTION,
        response_mime_type="application/json",
        response_json_schema=JudgeResponse.model_json_schema(),
        temperature=0.2,
        max_output_tokens=JUDGE_MAX_OUTPUT,
    )
    judge_resp = client.models.generate_content(
        model=judge_model or DEFAULT_JUDGE_MODEL,
        contents=payload,
        config=judge_cfg,
    )

    text = getattr(judge_resp, "text", None)
    if not text:
        raise JudgeCallError("judge returned empty response.text")

    try:
        parsed = json.loads(text)
        judge_data = JudgeResponse.model_validate(parsed)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise JudgeCallError(f"judge response is not valid JudgeResponse JSON: {exc}") from exc

    return ABResult(
        original_output=original_output,
        tuned_output=tuned_output,
        overall_winner=judge_data.overall_winner,
        overall_reasoning=judge_data.overall_reasoning,
        per_rule=judge_data.per_rule,
    )
