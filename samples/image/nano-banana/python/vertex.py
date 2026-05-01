"""Image generation (Nano Banana) against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.
"""

import base64
import os

from google import genai
from google.genai import types


def main(
    model: str = "gemini-3.1-flash-image-preview",
    prompt: str | None = None,
) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

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
            b64 = base64.b64encode(data).decode("ascii") if isinstance(data, bytes) else data
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
    out["images"] = [{"mime_type": i["mime_type"], "bytes": len(i["data_b64"])} for i in out["images"]]
    print(json.dumps(out, indent=2, default=str))
