"""Tests for the tune cost estimator."""

from __future__ import annotations

import pytest

from app.tune import (
    DEFAULT_JUDGE_MODEL,
    JUDGE_MAX_OUTPUT,
    TARGET_MAX_OUTPUT,
    TUNER_MAX_OUTPUT,
    _approx_tokens,
    estimate_cost,
)


# ---------------------------------------------------------------------------
# _approx_tokens heuristic
# ---------------------------------------------------------------------------

def test_approx_tokens_empty_string():
    assert _approx_tokens("") == 0


def test_approx_tokens_one_token_per_four_chars():
    assert _approx_tokens("abcd") == 1
    assert _approx_tokens("abcdefgh") == 2
    assert _approx_tokens("a" * 400) == 100


def test_approx_tokens_short_nonempty_at_least_one():
    assert _approx_tokens("a") == 1


# ---------------------------------------------------------------------------
# Tune-only path (run_ab=False)
# ---------------------------------------------------------------------------

def test_tune_only_has_one_leg():
    est = estimate_cost(prompt="hello", target_model="gemini-3-flash-preview")
    assert est.run_ab is False
    assert len(est.legs) == 1
    assert est.legs[0].label == "tuner"
    assert est.legs[0].model == "gemini-3-flash-preview"
    assert est.total_usd == est.legs[0].usd
    assert est.legs[0].usd > 0


def test_tune_only_total_matches_per_leg_math():
    """Manual math: input ≈ (5 chars + 4000 catalog chars) / 4 = ~1001 tokens.
    Flash input rate = $0.50 / MTok, output rate = $3.00 / MTok, output
    cap = 2000."""
    est = estimate_cost(prompt="hello", target_model="gemini-3-flash-preview")
    expected_input = _approx_tokens("hello") + _approx_tokens("x" * 4000)
    expected_usd = (expected_input * 0.50 + TUNER_MAX_OUTPUT * 3.00) / 1_000_000
    assert est.total_usd == pytest.approx(expected_usd, rel=1e-9)


# ---------------------------------------------------------------------------
# Run-AB path
# ---------------------------------------------------------------------------

def test_run_ab_has_four_legs():
    est = estimate_cost(
        prompt="hello",
        target_model="gemini-3-flash-preview",
        run_ab=True,
    )
    labels = [leg.label for leg in est.legs]
    assert labels == ["tuner", "target · original", "target · tuned", "judge"]


def test_run_ab_judge_uses_default_pro_model():
    est = estimate_cost(
        prompt="hello",
        target_model="gemini-3-flash-preview",
        run_ab=True,
    )
    judge_leg = next(leg for leg in est.legs if leg.label == "judge")
    assert judge_leg.model == DEFAULT_JUDGE_MODEL == "gemini-3.1-pro-preview"
    assert judge_leg.output_tokens_max == JUDGE_MAX_OUTPUT


def test_run_ab_target_legs_use_target_model_with_target_cap():
    est = estimate_cost(
        prompt="hello",
        target_model="gemini-3-flash-preview",
        run_ab=True,
    )
    for label in ("target · original", "target · tuned"):
        leg = next(leg for leg in est.legs if leg.label == label)
        assert leg.model == "gemini-3-flash-preview"
        assert leg.output_tokens_max == TARGET_MAX_OUTPUT


def test_run_ab_total_is_sum_of_legs():
    est = estimate_cost(
        prompt="hello",
        target_model="gemini-3-flash-preview",
        run_ab=True,
    )
    assert est.total_usd == pytest.approx(sum(leg.usd for leg in est.legs))


# ---------------------------------------------------------------------------
# Model overrides
# ---------------------------------------------------------------------------

def test_tuner_model_override():
    est = estimate_cost(
        prompt="hello",
        target_model="gemini-3-flash-preview",
        tuner_model="gemini-3.1-pro-preview",
    )
    assert est.legs[0].model == "gemini-3.1-pro-preview"
    # Pro is more expensive than Flash — tuner cost should reflect that.
    flash_est = estimate_cost(prompt="hello", target_model="gemini-3-flash-preview")
    assert est.total_usd > flash_est.total_usd


def test_judge_model_override():
    est = estimate_cost(
        prompt="hello",
        target_model="gemini-3-flash-preview",
        run_ab=True,
        judge_model="gemini-3-flash-preview",  # cheaper judge
    )
    judge_leg = next(leg for leg in est.legs if leg.label == "judge")
    assert judge_leg.model == "gemini-3-flash-preview"


# ---------------------------------------------------------------------------
# Long-context tier crossover
# ---------------------------------------------------------------------------

def test_long_context_threshold_pro():
    """gemini-3-pro-preview crosses to tier-2 at 200K input tokens.

    Build a prompt large enough that tuner_input > 200_000:
    input ≈ (prompt_chars + 4000) / 4 > 200_000
    → prompt_chars > 200_000 * 4 - 4000 = 796_000

    Use 1M chars to be safely past the threshold.
    """
    big_prompt = "x" * 1_000_000
    est = estimate_cost(
        prompt=big_prompt,
        target_model="gemini-3-pro-preview",
    )
    # Compute what tier-2 should produce.
    input_tokens = _approx_tokens(big_prompt) + _approx_tokens("x" * 4000)
    assert input_tokens > 200_000
    expected_usd = (input_tokens * 4.00 + TUNER_MAX_OUTPUT * 18.00) / 1_000_000
    assert est.legs[0].usd == pytest.approx(expected_usd, rel=1e-9)


def test_short_prompt_uses_tier_1_pro():
    est = estimate_cost(prompt="hello", target_model="gemini-3-pro-preview")
    # Tier-1 input rate = $2.00, output rate = $12.00.
    input_tokens = _approx_tokens("hello") + _approx_tokens("x" * 4000)
    expected_usd = (input_tokens * 2.00 + TUNER_MAX_OUTPUT * 12.00) / 1_000_000
    assert est.legs[0].usd == pytest.approx(expected_usd, rel=1e-9)


# ---------------------------------------------------------------------------
# Unknown models
# ---------------------------------------------------------------------------

def test_unknown_model_zero_cost_with_note():
    est = estimate_cost(
        prompt="hello",
        target_model="completely-made-up-model",
    )
    assert est.legs[0].usd == 0.0
    assert any("no rate-card entry" in note for note in est.notes)
    assert "completely-made-up-model" in est.notes[0]
