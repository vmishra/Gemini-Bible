"""Best-practices catalog — structured rules sourced from official Google docs.

Each YAML file under PRACTICES_DIR is one source URL's worth of rules. The
catalog loads at app startup; rules are looked up by `<file>#<id>` anchors
that diff hunks cite.

Schema (validated with Pydantic):

    source:
      url:   str          # canonical URL the rules are paraphrased from
      label: str          # short human-readable label
      as_of: str          # ISO date — staleness signal (yyyy-mm-dd)
    applies_to:
      model_families: [str]   # model id prefixes; tuner filters by this
    rules:
      - id:            str            # unique within file; cited by diff hunks
        title:         str            # rule headline
        rule:          str            # the imperative
        quote:         str            # verbatim source quote (with double quotes)
        why:           str            # why it matters in one paragraph
        applies_when:  str            # plain-English heuristic for the tuner
        severity:      blocking | recommended | informational

The `applies_when` heuristic is *plain English* (not a DSL). The tuner LLM
reads it and decides whether the rule fires for a given prompt.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, ValidationError

PRACTICES_DIR = Path(__file__).resolve().parents[1] / "practices"


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

Severity = Literal["blocking", "recommended", "informational"]


class Source(BaseModel):
    url: str
    label: str
    as_of: str  # yyyy-mm-dd


class AppliesTo(BaseModel):
    model_families: list[str] = Field(
        ...,
        description="Model id prefixes (e.g. 'gemini-3'). A model matches if any prefix matches.",
    )


class Rule(BaseModel):
    id: str
    title: str
    rule: str
    quote: str
    why: str
    applies_when: str
    severity: Severity

    # Populated by the loader, not the YAML file:
    file_stem: str = Field(default="", description="YAML file stem (loader-set).")
    source_url: str = Field(default="", description="Source URL (loader-set).")
    source_label: str = Field(default="", description="Source label (loader-set).")
    source_as_of: str = Field(default="", description="Source date (loader-set).")

    @property
    def anchor(self) -> str:
        """Catalog anchor — diff hunks cite this string."""
        return f"{self.file_stem}#{self.id}"


class CatalogFile(BaseModel):
    source: Source
    applies_to: AppliesTo
    rules: list[Rule]


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------

class CatalogError(Exception):
    """Raised when the catalog fails validation at startup."""


def _load_one(path: Path) -> CatalogFile:
    raw = yaml.safe_load(path.read_text())
    try:
        catalog = CatalogFile.model_validate(raw)
    except ValidationError as exc:
        raise CatalogError(f"{path.name}: schema validation failed\n{exc}") from exc

    # Anchor uniqueness within file.
    seen: set[str] = set()
    for rule in catalog.rules:
        if rule.id in seen:
            raise CatalogError(f"{path.name}: duplicate rule id {rule.id!r}")
        seen.add(rule.id)
        # Stamp the loader-side fields so callers get a fully-resolved Rule.
        rule.file_stem = path.stem
        rule.source_url = catalog.source.url
        rule.source_label = catalog.source.label
        rule.source_as_of = catalog.source.as_of

    return catalog


@lru_cache(maxsize=1)
def load_catalog(directory: Path | None = None) -> list[CatalogFile]:
    """Load and validate every *.yaml file under the catalog directory.

    Cached at process start; restart to pick up changes. Tests can clear
    the cache via `load_catalog.cache_clear()`.
    """
    root = directory or PRACTICES_DIR
    if not root.exists():
        return []
    files = sorted(root.glob("*.yaml"))
    return [_load_one(p) for p in files]


# ---------------------------------------------------------------------------
# Public lookup helpers
# ---------------------------------------------------------------------------

def all_rules() -> list[Rule]:
    """Flat list of every rule across every catalog file."""
    return [rule for catalog in load_catalog() for rule in catalog.rules]


def rules_for_model(model: str) -> list[Rule]:
    """Filter rules to those that apply to the given target model.

    Match is by prefix on `applies_to.model_families`. A rule with
    family "gemini-3" matches "gemini-3-flash-preview" and
    "gemini-3.1-pro-preview" alike.
    """
    out: list[Rule] = []
    for catalog in load_catalog():
        if any(model.startswith(family) for family in catalog.applies_to.model_families):
            out.extend(catalog.rules)
    return out


def rule_by_id(anchor: str) -> Rule | None:
    """Look up a rule by its `<file_stem>#<id>` anchor."""
    if "#" not in anchor:
        return None
    file_stem, rule_id = anchor.split("#", 1)
    for catalog in load_catalog():
        for rule in catalog.rules:
            if rule.file_stem == file_stem and rule.id == rule_id:
                return rule
    return None
