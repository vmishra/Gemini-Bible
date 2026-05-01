"""Structured (JSON) output against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Pattern: hand the model a Pydantic model_json_schema() and pin
response_mime_type to JSON. Field descriptions are forwarded as
per-field guidance to the model.
"""

import json
from typing import Literal

from google import genai
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


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or "Review: switching prod Cloud SQL from regional HA to a single zonal node to cut cost.",
        config={
            "response_mime_type": "application/json",
            "response_json_schema": ChangeReview.model_json_schema(),
        },
    )

    parsed = json.loads(response.text) if response.text else None
    usage = response.usage_metadata
    return {
        "text": response.text,
        "parsed": parsed,
        "model": model,
        "schema": ChangeReview.model_json_schema(),
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
