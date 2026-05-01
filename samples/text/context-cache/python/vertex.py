"""Explicit context caching against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.
"""

import os

from google import genai
from google.genai import types

PREFIX = (
    "ARCHITECTURE NOTES — INTERNAL\n"
    "============================\n\n"
    "The platform exposes a federated query layer that routes per-tenant "
    "reads through one of three storage tiers (hot Spanner, warm Bigtable, "
    "cold GCS Parquet) based on a tier policy evaluated at session start. "
) * 600


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

    cache = client.caches.create(
        model=model,
        config=types.CreateCachedContentConfig(
            display_name="gemini-bible-demo-cache",
            system_instruction=(
                "You are an internal staff engineer. Answer using only the "
                "architecture notes provided. If the notes don't cover the "
                "question, say so."
            ),
            contents=[PREFIX],
            ttl="120s",
        ),
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt
            or "Which storage tier handles cold analytics queries, and how is the tier chosen?",
            config=types.GenerateContentConfig(cached_content=cache.name),
        )

        usage = response.usage_metadata
        return {
            "text": response.text,
            "model": model,
            "cache_name": cache.name,
            "cache_token_count": getattr(cache.usage_metadata, "total_token_count", None)
            if getattr(cache, "usage_metadata", None)
            else None,
            "finish_reason": _finish_reason(response),
            "usage_metadata": usage.model_dump(mode="json") if usage else None,
        }
    finally:
        client.caches.delete(name=cache.name)


def _finish_reason(response) -> str | None:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return None
    fr = getattr(candidates[0], "finish_reason", None)
    return getattr(fr, "name", str(fr)) if fr else None


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
