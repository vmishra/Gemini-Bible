"""Music generation (Lyria clip mode) — Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
Lyria clip generation rides on generate_content with both AUDIO and TEXT
modalities — the model can return both an audio clip and lyrics or section
labels. The richer Lyria interface (weighted prompts, bpm/scale/density
knobs, realtime streaming) lives in client.aio.live.connect with a
lyria-realtime-* model — a separate sample, not yet covered.

  • response_modalities=["AUDIO", "TEXT"]
    The clip-mode endpoint returns audio inline_data parts AND text parts
    (lyrics / structural labels). Iterate every part and dispatch by
    inline_data vs text — order is not guaranteed.
    https://cloud.google.com/vertex-ai/generative-ai/docs/music/overview

  • response_mime_type
    Pro tier returns 16-bit PCM WAV; Clip preview returns MP3.

  • temperature=1.0, sampling defaults preserved
    Music benefits from variance — lower temperatures push toward
    repetitive loops.

  • Output handling
    Audio bytes arrive base64 from the SDK in some configurations and
    raw bytes in others. The walk below handles both.
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

    response = client.models.generate_content(
        model=model,
        contents=text_prompt,
        config=types.GenerateContentConfig(
            # ---- Modality routing (the deviation) ---------------------------
            response_modalities=["AUDIO", "TEXT"],
            # ---- Output codec -----------------------------------------------
            response_mime_type="audio/wav" if "pro" in model else None,
            # ---- Sampling ---------------------------------------------------
            temperature=1.0,            # default 1.0 preserved — music wants variance
            top_p=0.95,                 # default 0.95
            candidate_count=1,          # default 1
            # ---- Safety / Determinism (defaults) ----------------------------
            safety_settings=None,
            seed=None,                  # set int for reproducible test clips
        ),
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
