"""Sample registry. Scans `samples/` at startup; one manifest.json per sample directory."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

Surface = Literal["ai-studio", "vertex"]
Language = Literal["python", "typescript", "java"]


@dataclass(frozen=True)
class Variant:
    surface: Surface
    language: Language
    file: str
    entry: str


@dataclass(frozen=True)
class DocLink:
    label: str
    url: str


@dataclass(frozen=True)
class Sample:
    id: str
    category: str
    scenario: str
    title: str
    summary: str
    models: list[str]
    default_model: str
    variants: list[Variant]
    docs: list[DocLink]
    pricing: list[DocLink]
    notes: list[str]
    root: Path

    def variant(self, surface: Surface, language: Language) -> Variant | None:
        for v in self.variants:
            if v.surface == surface and v.language == language:
                return v
        return None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "scenario": self.scenario,
            "title": self.title,
            "summary": self.summary,
            "models": list(self.models),
            "default_model": self.default_model,
            "variants": [v.__dict__ for v in self.variants],
            "docs": [d.__dict__ for d in self.docs],
            "pricing": [d.__dict__ for d in self.pricing],
            "notes": list(self.notes),
        }


def _load_one(manifest_path: Path) -> Sample:
    raw = json.loads(manifest_path.read_text())
    return Sample(
        id=raw["id"],
        category=raw["category"],
        scenario=raw["scenario"],
        title=raw["title"],
        summary=raw["summary"],
        models=list(raw["models"]),
        default_model=raw["default_model"],
        variants=[Variant(**v) for v in raw["variants"]],
        docs=[DocLink(**d) for d in raw.get("docs", [])],
        pricing=[DocLink(**d) for d in raw.get("pricing", [])],
        notes=list(raw.get("notes", [])),
        root=manifest_path.parent,
    )


def load_all(samples_dir: Path) -> dict[str, Sample]:
    out: dict[str, Sample] = {}
    for manifest in samples_dir.rglob("manifest.json"):
        sample = _load_one(manifest)
        out[sample.id] = sample
    return out
