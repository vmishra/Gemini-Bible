"""Image generation (Nano Banana) against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
Image generation rides on generate_content with response_modalities flipped
to IMAGE. ImageConfig holds the per-image knobs (aspect ratio, size, person
generation policy, output codec). Inline image bytes return as base64 in
candidates[0].content.parts[*].inline_data.

  • response_modalities=["IMAGE"]
    Flips the model from text to image generation. To get both an image
    and a caption, use ["IMAGE","TEXT"] and iterate parts dispatching on
    inline_data vs text.
    https://cloud.google.com/vertex-ai/generative-ai/docs/image/overview

  • image_config.aspect_ratio="16:9"
    Common cinematic ratio. Other documented values: "1:1", "3:4", "4:3",
    "9:16", "16:9", "21:9". Unsupported ratios get rounded to the nearest
    documented one with no warning.

  • image_config.person_generation="ALLOW_ADULT"
    Three-valued knob: DONT_ALLOW (no people), ALLOW_ADULT (default in
    most regions), ALLOW_ALL (subject to regional availability). Set
    explicitly to make the policy visible in code.

  • image_config.output_mime_type="image/png"
    PNG is lossless; switch to "image/jpeg" + output_compression_quality
    when bandwidth matters more than fidelity.
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
        config=types.GenerateContentConfig(
            # ---- Modality routing (the deviation) ---------------------------
            response_modalities=["IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio="16:9",                # see WHY for ratio menu
                person_generation="ALLOW_ADULT",    # default in most regions
                output_mime_type="image/png",       # lossless; jpeg + quality for bandwidth
            ),
            # ---- Safety / Determinism (defaults) ----------------------------
            safety_settings=None,
            seed=None,                              # set int for repro test images
        ),
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
