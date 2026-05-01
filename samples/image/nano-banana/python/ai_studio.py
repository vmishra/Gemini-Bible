"""Image generation (Nano Banana) against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Inline image bytes are returned as base64 in the response payload —
the host runner forwards them to the UI as a data URL so they render
inline next to the prompt.
"""

import base64

from google import genai
from google.genai import types


def main(
    model: str = "gemini-3.1-flash-image-preview",
    prompt: str | None = None,
) -> dict:
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or "An overhead studio shot of a single ripe banana on a matte charcoal surface, soft directional light from the upper left, shallow depth of field, magazine cover composition.",
        config=types.GenerateContentConfig(response_modalities=["IMAGE"]),
    )

    images = []
    text_parts = []
    for part in (response.candidates[0].content.parts if response.candidates else []) or []:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data:
            data = inline.data
            if isinstance(data, bytes):
                b64 = base64.b64encode(data).decode("ascii")
            else:
                b64 = data  # SDK already returned base64-encoded
            images.append({"mime_type": inline.mime_type, "data_b64": b64})
        elif getattr(part, "text", None):
            text_parts.append(part.text)

    usage = response.usage_metadata
    return {
        "text": "\n".join(text_parts) or None,
        "model": model,
        "images": images,
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

    out = main()
    # Don't dump base64 to the terminal — show counts.
    out["images"] = [{"mime_type": i["mime_type"], "bytes": len(i["data_b64"])} for i in out["images"]]
    print(json.dumps(out, indent=2, default=str))
