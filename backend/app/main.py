"""Gemini Bible backend — auth probe, sample registry, executor, telemetry."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auth import detect
from .metrics import MetricsStore, _ASSET_NOTES, _PRICES, _USD_TO_INR
from . import practices
from .registry import load_all
from .runner import RunRequest, run

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLES_DIR = REPO_ROOT / "samples"

app = FastAPI(title="Gemini Bible", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5142", "http://127.0.0.1:5142"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLES = load_all(SAMPLES_DIR)
METRICS = MetricsStore(window=100)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth")
def auth() -> dict[str, object]:
    state = detect()
    return {
        "ai_studio": {
            "available": state.ai_studio_key_present,
            "source": state.ai_studio_key_source,
        },
        "vertex": {
            "available": state.adc_present and state.vertex_project is not None,
            "adc_source": state.adc_source,
            "project": state.vertex_project,
            "location": state.vertex_location,
        },
        "surfaces": state.available_surfaces,
    }


@app.get("/api/samples")
def list_samples() -> dict[str, list[dict]]:
    return {"samples": [s.to_dict() for s in SAMPLES.values()]}


@app.get("/api/samples/{sample_id}")
def get_sample(sample_id: str) -> dict:
    sample = SAMPLES.get(sample_id)
    if sample is None:
        raise HTTPException(404, f"sample {sample_id!r} not found")
    body = sample.to_dict()
    body["sources"] = {
        f"{v.surface}:{v.language}": (sample.root / v.file).read_text()
        for v in sample.variants
    }
    return body


class RunBody(BaseModel):
    surface: str
    language: str
    model: str | None = None
    prompt: str | None = None
    code_override: str | None = None


@app.post("/api/samples/{sample_id}/run")
def run_sample(sample_id: str, body: RunBody) -> dict:
    sample = SAMPLES.get(sample_id)
    if sample is None:
        raise HTTPException(404, f"sample {sample_id!r} not found")
    variant = sample.variant(body.surface, body.language)  # type: ignore[arg-type]
    if variant is None:
        raise HTTPException(
            404, f"sample {sample_id!r} has no {body.language} variant for {body.surface}"
        )

    result = run(
        sample,
        variant,
        RunRequest(
            surface=body.surface,
            language=body.language,
            model=body.model,
            prompt=body.prompt,
            code_override=body.code_override,
        ),
    )

    if result.metrics:
        METRICS.record({**result.metrics, "sample_id": sample_id, "surface": body.surface})

    return result.__dict__


@app.get("/api/metrics")
def metrics() -> dict:
    return METRICS.snapshot()


@app.post("/api/metrics/reset")
def metrics_reset() -> dict:
    METRICS.reset()
    return {"reset": True}


@app.get("/api/pricing")
def pricing() -> dict:
    """Public rate card snapshot. Refresh in metrics.py against ai.google.dev/pricing."""
    rate_card: dict[str, dict] = {}
    for model, rate in _PRICES.items():
        rate_card[model] = {
            "input_per_mtok_usd": rate.input_per_mtok,
            "output_per_mtok_usd": rate.output_per_mtok,
            "cached_input_per_mtok_usd": rate.cached_input_per_mtok,
            "audio_input_per_mtok_usd": rate.audio_input_per_mtok,
            "cached_audio_per_mtok_usd": rate.cached_audio_per_mtok,
            "image_input_per_mtok_usd": rate.image_input_per_mtok,
            "video_input_per_mtok_usd": rate.video_input_per_mtok,
            "long_context_threshold_tokens": rate.long_context_threshold_tokens,
            "long_context_input_per_mtok_usd": rate.long_context_input_per_mtok,
            "long_context_output_per_mtok_usd": rate.long_context_output_per_mtok,
            "long_context_cached_per_mtok_usd": rate.long_context_cached_per_mtok,
            "storage_per_mtok_per_hour_usd": rate.storage_per_mtok_per_hour,
            "asset_note": _ASSET_NOTES.get(model),
            "notes": rate.notes,
        }
    return {
        "rate_card": rate_card,
        "usd_to_inr": _USD_TO_INR,
        "as_of": "2026-04-30",
        "source_url": "https://ai.google.dev/pricing",
    }


@app.get("/api/practices")
def list_practices(model: str | None = None) -> dict:
    """Best-practices catalog. With ?model=, returns only the rules that
    apply to that target model (filtered by family-prefix match)."""
    rules = practices.rules_for_model(model) if model else practices.all_rules()
    return {
        "model": model,
        "count": len(rules),
        "rules": [
            {
                "anchor": r.anchor,
                "id": r.id,
                "file_stem": r.file_stem,
                "title": r.title,
                "rule": r.rule,
                "quote": r.quote,
                "why": r.why,
                "applies_when": r.applies_when,
                "severity": r.severity,
                "source_url": r.source_url,
                "source_label": r.source_label,
                "source_as_of": r.source_as_of,
            }
            for r in rules
        ],
    }
