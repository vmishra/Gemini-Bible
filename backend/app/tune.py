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

from typing import Literal

from pydantic import BaseModel, Field

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
