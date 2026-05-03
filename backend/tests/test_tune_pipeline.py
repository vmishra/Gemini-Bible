"""Tests for the tuner pipeline (tune_prompt) end-to-end against the mock client."""

from __future__ import annotations

import json

import pytest

from app.practices import load_catalog
from app.tune import (
    MAX_HUNKS_PER_TUNE,
    TUNER_MAX_OUTPUT,
    TUNER_SYSTEM_INSTRUCTION,
    TunerCallError,
    tune_prompt,
)


@pytest.fixture(autouse=True)
def _reset_catalog():
    load_catalog.cache_clear()
    yield
    load_catalog.cache_clear()


def _stub_tuner_response(hunks: list[dict]) -> str:
    """Helper: serialise a list of DiffHunk dicts as the JSON the tuner
    model would return."""
    return json.dumps({"hunks": hunks})


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_tuner_call_shape_and_result(mock_client):
    """The tuner is called once with the right config; result reconstructs."""
    stub, captured = mock_client

    captured.responses.push(_stub_tuner_response([
        {
            "op": "replace",
            "before": "Please carefully ",
            "after": "",
            "rule_anchor": "prompting-3x#be-precise-not-elaborate",
            "rationale": "Stripping the persuasive preamble.",
        }
    ]))

    result = tune_prompt(
        prompt="Please carefully explain transformers in three sentences.",
        target_model="gemini-3-flash-preview",
        client=stub,
    )

    # Result shape.
    assert result.original == "Please carefully explain transformers in three sentences."
    assert result.tuned == "explain transformers in three sentences."
    assert len(result.hunks) == 1
    assert result.hunks[0].rule_anchor == "prompting-3x#be-precise-not-elaborate"

    # Quote was stamped from the catalog.
    assert result.hunks[0].quote.startswith('"Verbose')

    # rules_considered enumerates what was offered to the tuner.
    assert "prompting-3x#be-precise-not-elaborate" in result.rules_considered
    assert "structured-output#temperature-low-for-json" in result.rules_considered

    # Tuner call shape — verify the SDK call carried the right config.
    [(path, kw)] = [(p, k) for p, k in captured.calls if p == "models.generate_content"]
    cfg = kw["config"]
    assert cfg.temperature == 0.2
    assert cfg.max_output_tokens == TUNER_MAX_OUTPUT
    assert cfg.response_mime_type == "application/json"
    assert cfg.response_json_schema is not None
    assert cfg.system_instruction == TUNER_SYSTEM_INSTRUCTION


def test_empty_hunks_is_valid_already_good(mock_client):
    """An already-well-formed prompt → empty hunks → tuned == original."""
    stub, captured = mock_client
    captured.responses.push(_stub_tuner_response([]))

    result = tune_prompt(
        prompt="Summarise this in three sentences.",
        target_model="gemini-3-flash-preview",
        client=stub,
    )
    assert result.hunks == []
    assert result.tuned == result.original


def test_multiple_non_overlapping_hunks(mock_client):
    stub, captured = mock_client
    captured.responses.push(_stub_tuner_response([
        {
            "op": "replace",
            "before": "Please carefully ",
            "after": "",
            "rule_anchor": "prompting-3x#be-precise-not-elaborate",
            "rationale": "Strip persuasive preamble.",
        },
        {
            "op": "replace",
            "before": "you are an expert who ",
            "after": "",
            "rule_anchor": "prompting-3x#be-precise-not-elaborate",
            "rationale": "Strip role priming.",
        },
    ]))

    prompt = "Please carefully explain — you are an expert who knows transformers — in three sentences."
    result = tune_prompt(
        prompt=prompt,
        target_model="gemini-3-flash-preview",
        client=stub,
    )
    assert len(result.hunks) == 2
    assert "Please carefully" not in result.tuned
    assert "you are an expert" not in result.tuned


# ---------------------------------------------------------------------------
# Error modes
# ---------------------------------------------------------------------------

def test_hallucinated_rule_anchor_raises(mock_client):
    stub, captured = mock_client
    captured.responses.push(_stub_tuner_response([
        {
            "op": "replace",
            "before": "x",
            "after": "y",
            "rule_anchor": "prompting-3x#does-not-exist",
            "rationale": "fake.",
        }
    ]))
    with pytest.raises(TunerCallError, match="unknown rule anchor"):
        tune_prompt(
            prompt="x prompt",
            target_model="gemini-3-flash-preview",
            client=stub,
        )


def test_invalid_json_raises(mock_client):
    stub, captured = mock_client
    captured.responses.push("this is not JSON at all")

    with pytest.raises(TunerCallError, match="not valid TunerResponse JSON"):
        tune_prompt(
            prompt="anything",
            target_model="gemini-3-flash-preview",
            client=stub,
        )


def test_too_many_hunks_rejected_by_schema(mock_client):
    """The TunerResponse schema caps hunks at MAX_HUNKS_PER_TUNE."""
    stub, captured = mock_client
    too_many = [
        {
            "op": "replace",
            "before": chr(ord("a") + i),
            "after": "X",
            "rule_anchor": "prompting-3x#be-precise-not-elaborate",
            "rationale": "x",
        }
        for i in range(MAX_HUNKS_PER_TUNE + 1)
    ]
    captured.responses.push(_stub_tuner_response(too_many))

    with pytest.raises(TunerCallError, match="not valid TunerResponse JSON"):
        tune_prompt(
            prompt="abcdef prompt",
            target_model="gemini-3-flash-preview",
            client=stub,
        )


def test_empty_response_text_raises(mock_client):
    stub, captured = mock_client
    captured.responses.push("")
    with pytest.raises(TunerCallError, match="empty response"):
        tune_prompt(
            prompt="anything",
            target_model="gemini-3-flash-preview",
            client=stub,
        )


# ---------------------------------------------------------------------------
# Model routing
# ---------------------------------------------------------------------------

def test_default_tuner_is_target_model(mock_client):
    stub, captured = mock_client
    captured.responses.push(_stub_tuner_response([]))

    tune_prompt(
        prompt="x",
        target_model="gemini-3-flash-preview",
        client=stub,
    )
    [(_, kw)] = [(p, k) for p, k in captured.calls if p == "models.generate_content"]
    assert kw["model"] == "gemini-3-flash-preview"


def test_tuner_model_override_used_when_set(mock_client):
    stub, captured = mock_client
    captured.responses.push(_stub_tuner_response([]))

    tune_prompt(
        prompt="x",
        target_model="gemini-3-flash-preview",
        tuner_model="gemini-3.1-pro-preview",
        client=stub,
    )
    [(_, kw)] = [(p, k) for p, k in captured.calls if p == "models.generate_content"]
    assert kw["model"] == "gemini-3.1-pro-preview"
