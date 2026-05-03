"""Tests for the POST /api/tune endpoint."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.practices import load_catalog


@pytest.fixture(autouse=True)
def _reset_catalog():
    load_catalog.cache_clear()
    yield
    load_catalog.cache_clear()


@pytest.fixture
def client_with_mock(mock_client) -> tuple[TestClient, object]:
    """The TestClient + the captured object so tests can queue responses."""
    _, captured = mock_client
    return TestClient(app), captured


def _tuner_response(hunks: list[dict]) -> str:
    return json.dumps({"hunks": hunks})


def _judge_response(
    *,
    overall: str = "tuned",
    overall_reasoning: str = "tuned was tighter",
    per_rule: list[dict] | None = None,
) -> str:
    if per_rule is None:
        per_rule = [{
            "rule_anchor": "prompting-3x#be-precise-not-elaborate",
            "verdict": "helped",
            "reasoning": "tuned dropped the persuasive preamble",
        }]
    return json.dumps({
        "overall_winner": overall,
        "overall_reasoning": overall_reasoning,
        "per_rule": per_rule,
    })


# ---------------------------------------------------------------------------
# Happy path — tune-only
# ---------------------------------------------------------------------------

def test_tune_only_returns_diff_and_estimate(client_with_mock):
    client, captured = client_with_mock
    captured.responses.push(_tuner_response([{
        "op": "delete",
        "before": "Please carefully ",
        "after": "",
        "rule_anchor": "prompting-3x#be-precise-not-elaborate",
        "rationale": "Persuasive preamble.",
    }]))

    resp = client.post("/api/tune", json={
        "prompt": "Please carefully explain transformers.",
        "target_model": "gemini-3-flash-preview",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["original"] == "Please carefully explain transformers."
    assert body["tuned"] == "explain transformers."
    assert len(body["hunks"]) == 1
    assert body["hunks"][0]["rule_anchor"] == "prompting-3x#be-precise-not-elaborate"
    assert body["cost_estimate"]["total_usd"] > 0
    assert body["ab"] is None  # opt-in


# ---------------------------------------------------------------------------
# Happy path — with A/B + judge
# ---------------------------------------------------------------------------

def test_run_ab_includes_judge_verdict(client_with_mock):
    client, captured = client_with_mock
    # tuner → original target → tuned target → judge
    captured.responses.push(_tuner_response([{
        "op": "delete",
        "before": "Please carefully ",
        "after": "",
        "rule_anchor": "prompting-3x#be-precise-not-elaborate",
        "rationale": "Persuasive preamble.",
    }]))
    captured.responses.push("Original output.")
    captured.responses.push("Tuned output.")
    captured.responses.push(_judge_response())

    resp = client.post("/api/tune", json={
        "prompt": "Please carefully explain transformers.",
        "target_model": "gemini-3-flash-preview",
        "run_ab": True,
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ab"] is not None
    ab = body["ab"]
    assert ab["original_output"] == "Original output."
    assert ab["tuned_output"] == "Tuned output."
    assert ab["overall_winner"] == "tuned"
    assert len(ab["per_rule"]) == 1


def test_run_ab_skipped_when_zero_hunks(client_with_mock):
    """No diff → no point in A/B. Only one SDK call (the tuner), no judge."""
    client, captured = client_with_mock
    captured.responses.push(_tuner_response([]))

    resp = client.post("/api/tune", json={
        "prompt": "Already a clean prompt.",
        "target_model": "gemini-3-flash-preview",
        "run_ab": True,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["hunks"] == []
    assert body["ab"] is None  # skipped
    # Only the tuner's generate_content was called, not the AB+judge legs.
    gen_calls = [p for p, _ in captured.calls if p == "models.generate_content"]
    assert len(gen_calls) == 1


# ---------------------------------------------------------------------------
# Error mapping
# ---------------------------------------------------------------------------

def test_hallucinated_rule_anchor_returns_422(client_with_mock):
    client, captured = client_with_mock
    captured.responses.push(_tuner_response([{
        "op": "delete",
        "before": "x",
        "after": "",
        "rule_anchor": "fake#anchor",
        "rationale": "x",
    }]))

    resp = client.post("/api/tune", json={
        "prompt": "x prompt",
        "target_model": "gemini-3-flash-preview",
    })
    assert resp.status_code == 422
    assert "unknown rule anchor" in resp.json()["detail"]


def test_diff_apply_error_returns_422(client_with_mock):
    """Tuner-emitted hunks that don't apply (e.g. multi-match anchor)
    surface as 422, not a 500."""
    client, captured = client_with_mock
    captured.responses.push(_tuner_response([{
        "op": "delete",
        "before": "the",  # appears twice in the prompt below
        "after": "",
        "rule_anchor": "prompting-3x#be-precise-not-elaborate",
        "rationale": "x",
    }]))

    resp = client.post("/api/tune", json={
        "prompt": "the cat sat on the mat",
        "target_model": "gemini-3-flash-preview",
    })
    assert resp.status_code == 422
    assert "multiple times" in resp.json()["detail"]


def test_cost_ceiling_returns_413(client_with_mock, monkeypatch):
    """Lower the env ceiling enough that even a tiny tune trips it."""
    client, _ = client_with_mock
    monkeypatch.setenv("TUNE_MAX_USD", "0.0001")

    resp = client.post("/api/tune", json={
        "prompt": "anything",
        "target_model": "gemini-3-flash-preview",
    })
    assert resp.status_code == 413
    detail = resp.json()["detail"]
    assert detail["error"] == "estimated cost exceeds ceiling"
    assert detail["ceiling_usd"] == 0.0001
    assert detail["estimate_usd"] > 0.0001
    assert detail["raise_with_env"] == "TUNE_MAX_USD"


def test_judge_error_returns_502(client_with_mock):
    client, captured = client_with_mock
    captured.responses.push(_tuner_response([{
        "op": "delete",
        "before": "x",
        "after": "",
        "rule_anchor": "prompting-3x#be-precise-not-elaborate",
        "rationale": "x",
    }]))
    captured.responses.push("o")
    captured.responses.push("t")
    captured.responses.push("garbage from the judge")

    resp = client.post("/api/tune", json={
        "prompt": "x prompt",
        "target_model": "gemini-3-flash-preview",
        "run_ab": True,
    })
    assert resp.status_code == 502
    assert "JudgeResponse" in resp.json()["detail"]


def test_empty_prompt_returns_422(client_with_mock):
    client, _ = client_with_mock
    resp = client.post("/api/tune", json={
        "prompt": "",
        "target_model": "gemini-3-flash-preview",
    })
    # Pydantic validation kicks in before we touch the model.
    assert resp.status_code == 422
