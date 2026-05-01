"""System instruction against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.
"""

import os

from google import genai
from google.genai import types

SYSTEM_INSTRUCTION = (
    "You are a senior platform engineer reviewing infrastructure changes. "
    "Be terse. Lead with the risk. Quote the exact resource or flag at issue. "
    "Skip pleasantries."
)


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or "We're switching the prod Cloud SQL instance from a regional HA pair to a single zonal node to save cost. Sign-off?",
        config=types.GenerateContentConfig(system_instruction=SYSTEM_INSTRUCTION),
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "system_instruction": SYSTEM_INSTRUCTION,
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
    import json

    print(json.dumps(main(), indent=2, default=str))
