"""Tests for the A/B + judge pipeline."""

from __future__ import annotations

import json

import pytest

from app.tune import (
    DEFAULT_JUDGE_MODEL,
    JUDGE_MAX_OUTPUT,
    JUDGE_SYSTEM_INSTRUCTION,
    TARGET_MAX_OUTPUT,
    DiffHunk,
    JudgeCallError,
    run_ab_and_judge,
)


def _judge_payload(
    *,
    overall: str = "tuned",
    overall_reasoning: str = "tuned was tighter",
    per_rule: list[dict] | None = None,
) -> str:
    if per_rule is None:
        per_rule = [
            {
                "rule_anchor": "prompting-3x#be-precise-not-elaborate",
                "verdict": "helped",
                "reasoning": "Tuned dropped the persuasive preamble.",
                "evidence_quote_original": "Please carefully",
                "evidence_quote_tuned": None,
            }
        ]
    return json.dumps({
        "overall_winner": overall,
        "overall_reasoning": overall_reasoning,
        "per_rule": per_rule,
    })


def _hunk(rule_anchor="prompting-3x#be-precise-not-elaborate") -> DiffHunk:
    return DiffHunk(
        op="delete",
        before="Please carefully ",
        after="",
        rule_anchor=rule_anchor,
        rationale="Strip persuasive preamble.",
    )


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_three_calls_in_order(mock_client):
    """run_ab_and_judge issues exactly three generate_content calls."""
    stub, captured = mock_client

    # Two target outputs, then judge.
    captured.responses.push("Original output text.")
    captured.responses.push("Tuned output text.")
    captured.responses.push(_judge_payload())

    result = run_ab_and_judge(
        original_prompt="Please carefully explain.",
        tuned_prompt="explain.",
        hunks=[_hunk()],
        target_model="gemini-3-flash-preview",
        client=stub,
    )

    gen_calls = [(p, kw) for p, kw in captured.calls if p == "models.generate_content"]
    assert len(gen_calls) == 3

    # First two go to target_model, third to judge.
    assert gen_calls[0][1]["model"] == "gemini-3-flash-preview"
    assert gen_calls[1][1]["model"] == "gemini-3-flash-preview"
    assert gen_calls[2][1]["model"] == DEFAULT_JUDGE_MODEL

    # Result captures both outputs + judge verdict.
    assert result.original_output == "Original output text."
    assert result.tuned_output == "Tuned output text."
    assert result.overall_winner == "tuned"
    assert len(result.per_rule) == 1
    assert result.per_rule[0].verdict == "helped"


def test_target_calls_use_target_max_output_cap(mock_client):
    stub, captured = mock_client
    captured.responses.push("o")
    captured.responses.push("t")
    captured.responses.push(_judge_payload())

    run_ab_and_judge(
        original_prompt="x",
        tuned_prompt="y",
        hunks=[_hunk()],
        target_model="gemini-3-flash-preview",
        client=stub,
    )

    gen_calls = [(p, kw) for p, kw in captured.calls if p == "models.generate_content"]
    for path, kw in gen_calls[:2]:
        assert kw["config"].max_output_tokens == TARGET_MAX_OUTPUT


def test_judge_call_uses_strict_config(mock_client):
    stub, captured = mock_client
    captured.responses.push("o")
    captured.responses.push("t")
    captured.responses.push(_judge_payload())

    run_ab_and_judge(
        original_prompt="x",
        tuned_prompt="y",
        hunks=[_hunk()],
        target_model="gemini-3-flash-preview",
        client=stub,
    )

    judge_call = [kw for p, kw in captured.calls if p == "models.generate_content"][2]
    cfg = judge_call["config"]
    assert cfg.temperature == 0.2
    assert cfg.max_output_tokens == JUDGE_MAX_OUTPUT
    assert cfg.response_mime_type == "application/json"
    assert cfg.response_json_schema is not None
    assert cfg.system_instruction == JUDGE_SYSTEM_INSTRUCTION


def test_judge_model_override(mock_client):
    stub, captured = mock_client
    captured.responses.push("o")
    captured.responses.push("t")
    captured.responses.push(_judge_payload())

    run_ab_and_judge(
        original_prompt="x",
        tuned_prompt="y",
        hunks=[_hunk()],
        target_model="gemini-3-flash-preview",
        judge_model="gemini-3-flash-preview",
        client=stub,
    )
    judge_call = [kw for p, kw in captured.calls if p == "models.generate_content"][2]
    assert judge_call["model"] == "gemini-3-flash-preview"


def test_per_rule_verdict_categories(mock_client):
    """Judge can issue any of the four per-rule verdicts."""
    stub, captured = mock_client
    per_rule = [
        {"rule_anchor": "r#h", "verdict": "helped", "reasoning": "x"},
        {"rule_anchor": "r#u", "verdict": "hurt", "reasoning": "x"},
        {"rule_anchor": "r#n", "verdict": "no_change", "reasoning": "x"},
        {"rule_anchor": "r#?", "verdict": "unclear", "reasoning": "x"},
    ]
    captured.responses.push("o")
    captured.responses.push("t")
    captured.responses.push(_judge_payload(per_rule=per_rule))

    result = run_ab_and_judge(
        original_prompt="x",
        tuned_prompt="y",
        hunks=[_hunk()],
        target_model="gemini-3-flash-preview",
        client=stub,
    )
    verdicts = [r.verdict for r in result.per_rule]
    assert verdicts == ["helped", "hurt", "no_change", "unclear"]


# ---------------------------------------------------------------------------
# Error modes
# ---------------------------------------------------------------------------

def test_judge_invalid_json_raises(mock_client):
    stub, captured = mock_client
    captured.responses.push("o")
    captured.responses.push("t")
    captured.responses.push("not json at all")

    with pytest.raises(JudgeCallError, match="not valid JudgeResponse"):
        run_ab_and_judge(
            original_prompt="x",
            tuned_prompt="y",
            hunks=[_hunk()],
            target_model="gemini-3-flash-preview",
            client=stub,
        )


def test_judge_empty_response_raises(mock_client):
    stub, captured = mock_client
    captured.responses.push("o")
    captured.responses.push("t")
    captured.responses.push("")

    with pytest.raises(JudgeCallError, match="empty response"):
        run_ab_and_judge(
            original_prompt="x",
            tuned_prompt="y",
            hunks=[_hunk()],
            target_model="gemini-3-flash-preview",
            client=stub,
        )


def test_invalid_overall_winner_raises(mock_client):
    """`overall_winner` must be one of original/tuned/tie."""
    stub, captured = mock_client
    captured.responses.push("o")
    captured.responses.push("t")
    captured.responses.push(json.dumps({
        "overall_winner": "neither",  # invalid
        "overall_reasoning": "x",
        "per_rule": [],
    }))

    with pytest.raises(JudgeCallError, match="not valid JudgeResponse"):
        run_ab_and_judge(
            original_prompt="x",
            tuned_prompt="y",
            hunks=[_hunk()],
            target_model="gemini-3-flash-preview",
            client=stub,
        )
