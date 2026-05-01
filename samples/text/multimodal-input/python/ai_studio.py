"""Multimodal input (image + text) against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Pattern: build a contents list of [Part.from_bytes(image, mime), text].
The model sees image and text as one prompt; per-modality token counts
appear in usage_metadata.prompt_tokens_details.
"""

import urllib.request

from google import genai
from google.genai import types

# A small public sample image — substitute your own when adapting.
SAMPLE_IMAGE_URL = "https://storage.googleapis.com/generativeai-downloads/images/scones.jpg"


def _fetch(url: str) -> tuple[bytes, str]:
    with urllib.request.urlopen(url, timeout=15) as resp:
        return resp.read(), resp.headers.get_content_type() or "image/jpeg"


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client()
    image_bytes, mime = _fetch(SAMPLE_IMAGE_URL)

    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime),
            prompt or "Caption this image in one sentence, then list every distinct ingredient you can identify.",
        ],
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "image_url": SAMPLE_IMAGE_URL,
        "image_bytes": len(image_bytes),
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
