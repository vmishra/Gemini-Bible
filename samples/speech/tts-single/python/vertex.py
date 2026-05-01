"""TTS — single speaker — against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.
"""

import base64
import io
import os
import wave

from google import genai
from google.genai import types


def _wrap_pcm_as_wav(pcm: bytes, *, channels: int = 1, rate: int = 24000, sample_width: int = 2) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(rate)
        wf.writeframes(pcm)
    return buf.getvalue()


def main(
    model: str = "gemini-3.1-flash-tts-preview",
    prompt: str | None = None,
    voice: str = "Kore",
) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or "Say cheerfully and a touch conspiratorially: Have a wonderful day — and do tell me how it went.",
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice),
                ),
            ),
        ),
    )

    pcm = response.candidates[0].content.parts[0].inline_data.data
    if isinstance(pcm, str):
        pcm = base64.b64decode(pcm)
    wav_bytes = _wrap_pcm_as_wav(pcm)

    usage = response.usage_metadata
    return {
        "text": f"Spoke {len(pcm):,} bytes of PCM ({len(pcm) / (24000 * 2):.2f} s) using voice {voice!r}.",
        "model": model,
        "voice": voice,
        "audio": {
            "mime_type": "audio/wav",
            "bytes": len(wav_bytes),
            "data_b64": base64.b64encode(wav_bytes).decode("ascii"),
        },
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
    out["audio"] = {k: (v if k != "data_b64" else f"<{len(v):,} chars>") for k, v in out["audio"].items()}
    print(json.dumps(out, indent=2, default=str))
