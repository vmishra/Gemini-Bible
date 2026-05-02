"""Structured (JSON) output against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. Structured-output deviations:

  • temperature=0.2 (down from default 1.0)
    Lower temperature dramatically reduces JSON formatting drift — the
    model commits to one tree shape early instead of resampling near the
    end of long arrays. The model still picks values, but it stops second-
    guessing the schema. Don't go lower than 0.2 unless you also pin a
    seed; below 0.1 the model can collapse onto a single canned answer.
    https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output

  • response_mime_type="application/json" + response_json_schema=...
    Together they switch the model into constrained-decoding mode. The
    schema accepts any JSON-Schema dict; using Pydantic's
    .model_json_schema() keeps the schema and the parser in lockstep.

  • thinking_level="medium" (Gemini 3.x default is "high")
    Same rationale as text/basic.
"""

import json
import os
from typing import Literal

from google import genai
from google.genai import types
from pydantic import BaseModel, Field


class Risk(BaseModel):
    severity: Literal["low", "medium", "high", "critical"]
    summary: str = Field(description="One-line description of the risk, no preamble.")
    mitigations: list[str] = Field(
        description="Concrete mitigations, ordered by impact. Two to four entries."
    )


class ChangeReview(BaseModel):
    decision: Literal["approve", "approve_with_conditions", "reject"]
    risks: list[Risk]
    rollback_plan: str = Field(description="Single sentence stating exactly how to revert.")


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    """Routes the thinking knob to the right field per family.

    Gemini 3.x → thinking_level (string enum, default "high").
    Gemini 2.5 → thinking_budget (int token cap, -1 dynamic default).
    """
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level=level)
    return types.ThinkingConfig(thinking_budget=-1)


def main(
    model: str = "gemini-3-flash-preview",
    prompt: str | None = None,
    thinking_level: str = "medium",
) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or "Review: switching prod Cloud SQL from regional HA to a single zonal node to cut cost.",
        config=types.GenerateContentConfig(
            # ---- Output shape (the deviation) -------------------------------
            response_mime_type="application/json",
            response_json_schema=ChangeReview.model_json_schema(),
            # ---- Sampling ---------------------------------------------------
            # temperature ↓ for JSON consistency. See WHY THIS SHAPE.
            temperature=0.2,
            top_p=0.95,                 # default 0.95
            top_k=64,                   # default 64 on Gemini 3.x (was 40 on 2.5)
            candidate_count=1,          # default 1; >1 not supported on Gemini 3.x
            max_output_tokens=8192,     # default model-dependent; cap to bound spend
            # ---- Stop / Safety / Determinism (defaults) ---------------------
            stop_sequences=None,
            safety_settings=None,
            seed=None,                  # set int for bit-identical JSON across runs
            # ---- Reasoning --------------------------------------------------
            thinking_config=_thinking_config(model, thinking_level),
        ),
    )

    parsed = json.loads(response.text) if response.text else None
    usage = response.usage_metadata
    return {
        "text": response.text,
        "parsed": parsed,
        "model": model,
        "schema": ChangeReview.model_json_schema(),
        "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
        "thinking_value": thinking_level if model.startswith("gemini-3") else -1,
        "finish_reason": _finish_reason(response),
        "usage_metadata": usage.model_dump(mode="json") if usage else None,
    }


def _finish_reason(response) -> str | None:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return None
    fr = getattr(candidates[0], "finish_reason", None)
    return getattr(fr, "name", str(fr)) if fr else None


if __name__ == "__main__":
    print(json.dumps(main(), indent=2, default=str))
