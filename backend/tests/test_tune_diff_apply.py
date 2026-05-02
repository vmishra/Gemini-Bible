"""Tests for the deterministic diff-apply primitive in app.tune.

Pure-function tests — no fixtures needed beyond a small builder.
"""

from __future__ import annotations

import pytest

from app.tune import DiffApplyError, DiffHunk, apply_hunks


def hunk(before: str | None, after: str | None, op: str = "replace", anchor: str = "r#1") -> DiffHunk:
    return DiffHunk(op=op, before=before, after=after, rule_anchor=anchor, rationale="x")


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_no_hunks_returns_original_unchanged():
    assert apply_hunks("hello world", []) == "hello world"


def test_single_replace():
    out = apply_hunks(
        "the quick brown fox",
        [hunk(before="quick", after="fast")],
    )
    assert out == "the fast brown fox"


def test_single_delete_via_empty_after():
    # `after=""` is the documented delete form.
    out = apply_hunks(
        "please carefully consider the question",
        [hunk(before="please carefully ", after="", op="delete")],
    )
    assert out == "consider the question"


def test_single_insert_via_anchor_pattern():
    """Inserts use a unique anchor: `before` is the anchor, `after` is the
    anchor + new text wrapped around it."""
    out = apply_hunks(
        "Summarise the doc.",
        [hunk(
            before="Summarise the doc.",
            after="Summarise the doc.\n\nKeep it under 100 words.",
            op="insert",
        )],
    )
    assert out == "Summarise the doc.\n\nKeep it under 100 words."


def test_multiple_non_overlapping_hunks_apply_in_any_input_order():
    original = "alpha beta gamma delta epsilon"
    h_a = hunk(before="alpha", after="A")
    h_g = hunk(before="gamma", after="G")
    h_e = hunk(before="epsilon", after="E")

    expected = "A beta G delta E"
    assert apply_hunks(original, [h_a, h_g, h_e]) == expected
    # Reverse order — same result (pure function, location is by string match).
    assert apply_hunks(original, [h_e, h_g, h_a]) == expected
    # Mixed order — same result.
    assert apply_hunks(original, [h_g, h_a, h_e]) == expected


def test_replacement_can_be_longer_than_before():
    out = apply_hunks(
        "T=0",
        [hunk(before="T=0", after="temperature=1.0  # Gemini 3 default")],
    )
    assert out == "temperature=1.0  # Gemini 3 default"


# ---------------------------------------------------------------------------
# Error modes
# ---------------------------------------------------------------------------

def test_empty_before_raises():
    with pytest.raises(DiffApplyError, match="`before` is required"):
        apply_hunks("hello", [hunk(before="", after="hi")])


def test_none_before_raises():
    with pytest.raises(DiffApplyError, match="`before` is required"):
        apply_hunks("hello", [hunk(before=None, after="hi")])


def test_before_not_found_raises():
    with pytest.raises(DiffApplyError, match="`before` not found"):
        apply_hunks("hello world", [hunk(before="nonexistent", after="x")])


def test_before_matches_multiple_times_raises():
    # "the" appears twice — not a unique anchor.
    with pytest.raises(DiffApplyError, match="multiple times"):
        apply_hunks(
            "the cat sat on the mat",
            [hunk(before="the", after="a")],
        )


def test_overlapping_spans_raise():
    # Both hunks try to claim "brown fox" / "fox jumps".
    original = "the quick brown fox jumps high"
    with pytest.raises(DiffApplyError, match="overlapping"):
        apply_hunks(
            original,
            [
                hunk(before="brown fox", after="dog", anchor="r#a"),
                hunk(before="fox jumps", after="leaps", anchor="r#b"),
            ],
        )


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------

def test_unicode_anchor_replace():
    """Em-dash in the anchor is treated like any other character — Python's
    native str slicing handles it correctly."""
    out = apply_hunks(
        "Explain attention — in three sentences.",
        [hunk(before="— in three sentences", after="briefly")],
    )
    assert out == "Explain attention briefly."


def test_unicode_anchor_must_still_be_unique():
    """Multi-match check fires the same way for non-ASCII anchors."""
    with pytest.raises(DiffApplyError, match="multiple times"):
        apply_hunks(
            "Explain — in three sentences — what attention is.",
            [hunk(before="—", after="-")],
        )


def test_long_before_string_truncated_in_error_message():
    long_before = "x" * 500
    with pytest.raises(DiffApplyError, match=r"x{60}…"):
        apply_hunks("nothing matches", [hunk(before=long_before, after="y")])


def test_replacement_with_after_none_is_treated_as_empty():
    # The schema allows after=None; apply treats it as empty (delete).
    out = apply_hunks(
        "remove this please",
        [hunk(before="remove this ", after=None, op="delete")],
    )
    assert out == "please"
