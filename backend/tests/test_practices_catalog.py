"""Tests for the best-practices catalog loader.

Verifies every YAML file in backend/practices/ parses + validates against
the Pydantic schema, anchor IDs are unique within each file, and the
public lookups (all_rules, rules_for_model, rule_by_id) return the
expected entries.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from app.practices import (
    CatalogError,
    CatalogFile,
    Rule,
    PRACTICES_DIR,
    _load_one,
    all_rules,
    load_catalog,
    rule_by_id,
    rules_for_model,
)


@pytest.fixture(autouse=True)
def reset_catalog_cache():
    """Catalog is lru_cached; clear before/after each test for isolation."""
    load_catalog.cache_clear()
    yield
    load_catalog.cache_clear()


# ---------------------------------------------------------------------------
# Real catalog files in backend/practices/
# ---------------------------------------------------------------------------

def test_every_yaml_file_loads_and_validates():
    """All shipped catalog files parse and pass schema validation."""
    catalogs = load_catalog()
    assert len(catalogs) >= 4, "expected at least 4 catalog files shipped"
    for cat in catalogs:
        assert cat.source.url.startswith("http")
        assert cat.source.label
        assert cat.source.as_of  # ISO date
        assert cat.applies_to.model_families, "model_families must be non-empty"
        assert cat.rules, f"{cat.source.label}: empty rules list"


def test_rule_anchors_unique_within_each_file():
    for cat in load_catalog():
        ids = [rule.id for rule in cat.rules]
        assert len(ids) == len(set(ids)), (
            f"{cat.source.label}: duplicate rule ids — {[i for i in ids if ids.count(i) > 1]}"
        )


def test_rule_loader_stamps_source_fields():
    """The loader fills file_stem, source_url, source_label, source_as_of."""
    rule = rule_by_id("prompting-3x#temperature-default")
    assert rule is not None
    assert rule.file_stem == "prompting-3x"
    assert rule.source_url.startswith("https://ai.google.dev")
    assert rule.source_label
    assert rule.source_as_of == "2026-04-30"


def test_anchor_property_round_trips():
    rule = rule_by_id("prompting-3x#be-precise-not-elaborate")
    assert rule is not None
    assert rule.anchor == "prompting-3x#be-precise-not-elaborate"


def test_severity_constrained_to_three_values():
    valid = {"blocking", "recommended", "informational"}
    for rule in all_rules():
        assert rule.severity in valid, f"{rule.anchor}: bad severity {rule.severity!r}"


def test_applies_when_is_non_trivial_prose():
    """Catch empty/placeholder applies_when text."""
    for rule in all_rules():
        assert len(rule.applies_when.strip()) >= 30, (
            f"{rule.anchor}: applies_when too short — must be a real heuristic"
        )


# ---------------------------------------------------------------------------
# rules_for_model filtering
# ---------------------------------------------------------------------------

def test_rules_for_gemini_3_flash_includes_3x_and_structured():
    anchors = {r.anchor for r in rules_for_model("gemini-3-flash-preview")}
    # Should pull from prompting-3x (family "gemini-3") and structured-output
    # (also includes "gemini-3" in its families list).
    assert any(a.startswith("prompting-3x#") for a in anchors)
    assert any(a.startswith("structured-output#") for a in anchors)
    # Should NOT pull 2.5-only rules.
    assert not any(a.startswith("prompting-2x#") for a in anchors)


def test_rules_for_gemini_2_5_includes_2x_and_structured():
    anchors = {r.anchor for r in rules_for_model("gemini-2.5-flash")}
    assert any(a.startswith("prompting-2x#") for a in anchors)
    assert any(a.startswith("structured-output#") for a in anchors)
    # Should NOT pull 3.x-only rules.
    assert not any(a.startswith("prompting-3x#") for a in anchors)


def test_rules_for_image_model_includes_image_rules():
    anchors = {r.anchor for r in rules_for_model("gemini-3.1-flash-image-preview")}
    assert any(a.startswith("image-generation#") for a in anchors)


def test_rules_for_unknown_model_is_empty():
    assert rules_for_model("nonexistent-model-xyz") == []


# ---------------------------------------------------------------------------
# rule_by_id lookups
# ---------------------------------------------------------------------------

def test_rule_by_id_known_anchor():
    rule = rule_by_id("prompting-3x#temperature-default")
    assert rule is not None
    assert rule.title == "Default temperature 1.0"
    assert rule.severity == "blocking"


def test_rule_by_id_unknown_anchor_returns_none():
    assert rule_by_id("prompting-3x#does-not-exist") is None
    assert rule_by_id("nonexistent-file#temperature-default") is None
    assert rule_by_id("malformed-no-hash") is None


# ---------------------------------------------------------------------------
# Failure modes (synthetic catalog files via tmp_path)
# ---------------------------------------------------------------------------

def test_duplicate_rule_id_within_file_raises(tmp_path: Path):
    bad = tmp_path / "bad.yaml"
    bad.write_text(yaml.safe_dump({
        "source": {"url": "https://x", "label": "x", "as_of": "2026-01-01"},
        "applies_to": {"model_families": ["gemini-3"]},
        "rules": [
            {"id": "dup", "title": "a", "rule": "x", "quote": "x",
             "why": "x", "applies_when": "x" * 40, "severity": "recommended"},
            {"id": "dup", "title": "b", "rule": "x", "quote": "x",
             "why": "x", "applies_when": "x" * 40, "severity": "recommended"},
        ],
    }))
    with pytest.raises(CatalogError, match="duplicate rule id 'dup'"):
        _load_one(bad)


def test_missing_required_field_raises(tmp_path: Path):
    bad = tmp_path / "missing.yaml"
    bad.write_text(yaml.safe_dump({
        "source": {"url": "https://x", "label": "x", "as_of": "2026-01-01"},
        "applies_to": {"model_families": ["gemini-3"]},
        "rules": [
            {"id": "x", "title": "x"},  # missing rule, quote, why, applies_when, severity
        ],
    }))
    with pytest.raises(CatalogError, match="schema validation failed"):
        _load_one(bad)


def test_invalid_severity_raises(tmp_path: Path):
    bad = tmp_path / "sev.yaml"
    bad.write_text(yaml.safe_dump({
        "source": {"url": "https://x", "label": "x", "as_of": "2026-01-01"},
        "applies_to": {"model_families": ["gemini-3"]},
        "rules": [
            {"id": "x", "title": "x", "rule": "x", "quote": "x",
             "why": "x", "applies_when": "x" * 40, "severity": "critical"},  # not in enum
        ],
    }))
    with pytest.raises(CatalogError, match="schema validation failed"):
        _load_one(bad)
