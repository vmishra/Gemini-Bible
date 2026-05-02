"""Multimodal input (image + text) against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. Multimodal-specific patterns:

  • contents is a list, not a string. Each element is a Part (or a string,
    which the SDK auto-wraps as a text Part). Order matters — image-first
    is the convention; the model attends to the image while reading the
    text question. Use Part.from_bytes for inline binaries up to ~20 MiB
    or Part.from_uri for GCS / public-URL hosted assets.
    https://ai.google.dev/gemini-api/docs/vision

  • response_modalities=["TEXT"] is the default. Set it explicitly so the
    sample is symmetric with image/nano-banana, which sets it to ["IMAGE"]
    to switch generation modes. Reader sees the knob exists.

  • Per-modality token counts surface on usage_metadata.prompt_tokens_details
    — image tokens are billed at the *image* rate (different from text).
    See the cost ladder slide for the per-modality breakdown.

  • thinking_level="medium" (Gemini 3.x default is "high")
    Same rationale as text/basic.
"""

import urllib.request

from google import genai
from google.genai import types


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    """Routes the thinking knob to the right field per family.

    Gemini 3.x → thinking_level (string enum, default "high").
    Gemini 2.5 → thinking_budget (int token cap, -1 dynamic default).
    """
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level=level)
    return types.ThinkingConfig(thinking_budget=-1)

# A small public sample image — substitute your own when adapting.
SAMPLE_IMAGE_URL = "https://storage.googleapis.com/generativeai-downloads/images/scones.jpg"


def _fetch(url: str) -> tuple[bytes, str]:
    with urllib.request.urlopen(url, timeout=15) as resp:
        return resp.read(), resp.headers.get_content_type() or "image/jpeg"


def main(
    model: str = "gemini-3-flash-preview",
    prompt: str | None = None,
    thinking_level: str = "medium",
) -> dict:
    client = genai.Client()
    image_bytes, mime = _fetch(SAMPLE_IMAGE_URL)

    response = client.models.generate_content(
        model=model,
        contents=[
            # Image-first by convention — the model attends to the asset
            # while reading the text question. Reverse only for "describe
            # this caption visually" style tasks.
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
            prompt or "Caption this image in one sentence, then list every distinct ingredient you can identify.",
        ],
        config=types.GenerateContentConfig(
            # ---- Modality routing -------------------------------------------
            # Default but set explicitly for symmetry with image/audio samples.
            response_modalities=["TEXT"],
            # ---- Sampling ---------------------------------------------------
            temperature=1.0,            # default 1.0; raise for creative, lower for JSON
            top_p=0.95,                 # default 0.95
            top_k=64,                   # default 64 on Gemini 3.x (was 40 on 2.5)
            candidate_count=1,          # default 1; >1 not supported on Gemini 3.x
            max_output_tokens=8192,     # default model-dependent; cap to bound spend
            # ---- Stop / Output / Safety / Determinism (defaults) ------------
            stop_sequences=None,
            response_mime_type="text/plain",
            safety_settings=None,
            seed=None,
            # ---- Reasoning --------------------------------------------------
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
