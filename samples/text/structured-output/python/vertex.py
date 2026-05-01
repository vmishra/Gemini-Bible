"""Structured (JSON) output against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.

Thinking: Gemini 3.x and 2.5 generate internal reasoning tokens by default.
3.x uses thinking_level ∈ {minimal, low, medium, high}, default "high";
2.5 uses thinking_budget int (-1 dynamic, 0 off on Flash). Set explicitly.
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
            response_mime_type="application/json",
            response_json_schema=ChangeReview.model_json_schema(),
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
