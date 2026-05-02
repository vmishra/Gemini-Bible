"""Image generation (Nano Banana) against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Image generation rides on generate_content with response_modalities flipped
to IMAGE. ImageConfig holds the per-image knobs (aspect ratio, size, person
generation policy, output codec). Inline image bytes return as base64 in
candidates[0].content.parts[*].inline_data — the host runner forwards them
to the UI as a data URL.

  • response_modalities=["IMAGE"]
    Flips the model from text to image generation. To get both an image
    and a caption, use ["IMAGE","TEXT"] and iterate parts dispatching on
    inline_data vs text.
    https://ai.google.dev/gemini-api/docs/image-generation

  • image_config.aspect_ratio="16:9"
    Common cinematic ratio. Other documented values: "1:1", "3:4", "4:3",
    "9:16", "16:9", "21:9". Unsupported ratios get rounded to the nearest
    documented one with no warning.

  • image_config.person_generation="ALLOW_ADULT"
    Three-valued knob: DONT_ALLOW (no people), ALLOW_ADULT (default in
    most regions), ALLOW_ALL (subject to regional availability). The
    default is region-dependent — set explicitly to make the policy
    visible in code.

  • image_config.output_mime_type="image/png"
    PNG is lossless; switch to "image/jpeg" + output_compression_quality
    when bandwidth matters more than fidelity. JPEG quality defaults to
    85 in the SDK.
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
