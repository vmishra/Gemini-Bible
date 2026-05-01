"""Music generation (Lyria) — Vertex AI.

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
    model: str = "lyria-3-clip-preview",
    prompt: str | None = None,
) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

    text_prompt = prompt or (
        "An instrumental, mid-tempo track for a product demo: warm analog synths, "
        "muted four-on-the-floor kick, a single sustained pad evolving over eight bars, "
        "no vocals. Modern, calm, optimistic."
    )

    config = types.GenerateContentConfig(response_modalities=["AUDIO", "TEXT"])
    if "pro" in model:
        config.response_mime_type = "audio/wav"

    response = client.models.generate_content(
        model=model,
        contents=text_prompt,
        config=config,
    )

    audio_clips: list[dict] = []
    text_parts: list[str] = []
    for part in (response.candidates[0].content.parts if response.candidates else []) or []:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data:
            data = inline.data
            b64 = base64.b64encode(data).decode("ascii") if isinstance(data, bytes) else data
            audio_clips.append(
                {
                    "mime_type": inline.mime_type or ("audio/wav" if "pro" in model else "audio/mpeg"),
                    "data_b64": b64,
                    "bytes": len(data) if isinstance(data, bytes) else len(b64) * 3 // 4,
                }
            )
        elif getattr(part, "text", None):
            text_parts.append(part.text)

    usage = response.usage_metadata
    primary = audio_clips[0] if audio_clips else None
    return {
        "text": "\n".join(text_parts) or f"Generated {len(audio_clips)} audio clip(s).",
        "model": model,
        "audio": primary,
        "audio_clips": audio_clips,
        "lyrics": "\n".join(text_parts) or None,
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
    if out.get("audio"):
        out["audio"] = {k: (v if k != "data_b64" else f"<{len(v):,} chars>") for k, v in out["audio"].items()}
    out["audio_clips"] = [
        {k: (v if k != "data_b64" else f"<{len(v):,} chars>") for k, v in c.items()}
        for c in out["audio_clips"]
    ]
    print(json.dumps(out, indent=2, default=str))
