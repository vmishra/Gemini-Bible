"""Tests for the GET /api/practices endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.practices import load_catalog


@pytest.fixture(autouse=True)
def reset_catalog_cache():
    load_catalog.cache_clear()
    yield
    load_catalog.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_get_practices_no_filter_returns_all(client: TestClient):
    resp = client.get("/api/practices")
    assert resp.status_code == 200
    body = resp.json()
    assert body["model"] is None
    assert body["count"] >= 18  # 4 catalog files × 3-7 rules each
    assert len(body["rules"]) == body["count"]


def test_get_practices_with_model_filters(client: TestClient):
    resp = client.get("/api/practices", params={"model": "gemini-3-flash-preview"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["model"] == "gemini-3-flash-preview"
    # Only 3.x and structured-output rules should be present, not 2.5.
    file_stems = {r["file_stem"] for r in body["rules"]}
    assert "prompting-3x" in file_stems
    assert "structured-output" in file_stems
    assert "prompting-2x" not in file_stems


def test_rule_dict_shape(client: TestClient):
    resp = client.get("/api/practices")
    rule = resp.json()["rules"][0]
    expected = {
        "anchor", "id", "file_stem", "title", "rule", "quote", "why",
        "applies_when", "severity", "source_url", "source_label", "source_as_of",
    }
    assert expected.issubset(rule.keys())


def test_unknown_model_returns_empty(client: TestClient):
    resp = client.get("/api/practices", params={"model": "nonexistent-model-zzz"})
    assert resp.status_code == 200
    assert resp.json()["count"] == 0
