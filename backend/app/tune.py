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
