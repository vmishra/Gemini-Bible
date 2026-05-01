"""Multimodal input (image + text) against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Vertex variant. Same prompt assembly; the only difference is the client.
For Vertex, you may also pass a GCS URI directly via
types.Part.from_uri('gs://…', mime_type='image/jpeg') — no download step.

Thinking: Gemini 3.x and 2.5 generate internal reasoning tokens by default.
3.x uses thinking_level ∈ {minimal, low, medium, high}, default "high";
2.5 uses thinking_budget int (-1 dynamic, 0 off on Flash). Set explicitly.
"""

import os
import urllib.request

from google import genai
from google.genai import types


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level=level)
    return types.ThinkingConfig(thinking_budget=-1)

SAMPLE_IMAGE_URL = "https://storage.googleapis.com/generativeai-downloads/images/scones.jpg"


def _fetch(url: str) -> tuple[bytes, str]:
    with urllib.request.urlopen(url, timeout=15) as resp:
        return resp.read(), resp.headers.get_content_type() or "image/jpeg"


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
    image_bytes, mime = _fetch(SAMPLE_IMAGE_URL)

    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
            prompt or "Caption this image in one sentence, then list every distinct ingredient you can identify.",
        ],
        config=types.GenerateContentConfig(
            thinking_config=_thinking_config(model, thinking_level),
        ),
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "image_url": SAMPLE_IMAGE_URL,
        "image_bytes": len(image_bytes),
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
    import json

    print(json.dumps(main(), indent=2, default=str))
