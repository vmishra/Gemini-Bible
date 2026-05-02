"""TTS — single speaker — against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
TTS rides on generate_content with response_modalities=["AUDIO"]. The
SpeechConfig surface is small but worth showing in full.

  • response_modalities=["AUDIO"]
    Switches the model to audio-only output. There is no plain-text
    return; everything is in candidates[0].content.parts[0].inline_data.

  • speech_config.voice_config.prebuilt_voice_config.voice_name="Kore"
    The prebuilt voices are documented per-model. "Kore" is a
    versatile, neutral default. Other prebuilt names: Aoede, Charon,
    Fenrir, Leda, Orus, Puck, Zephyr, etc. Each renders the same
    transcript with distinct prosody and timbre.
    https://ai.google.dev/gemini-api/docs/speech-generation

  • speech_config.language_code="en-US"
    Hint to the model. Defaults to inferring from the prompt; setting
    explicitly is more reliable for code-switched or short prompts.

  • Output format: raw 24 kHz mono 16-bit PCM
    Wrap in a WAV header before serving so browsers and audio editors
    can play it directly. The wave module's writeframes() does the
    little-endian framing for you.
"""

import base64
import io
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
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or "Say cheerfully and a touch conspiratorially: Have a wonderful day — and do tell me how it went.",
        config=types.GenerateContentConfig(
            # ---- Modality routing (the deviation) ---------------------------
            response_modalities=["AUDIO"],
            # ---- Voice ------------------------------------------------------
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice),
                ),
                language_code="en-US",     # explicit; defaults to inferred
            ),
            # ---- Safety / Determinism (defaults) ----------------------------
            safety_settings=None,
            seed=None,
        ),
    )

    pcm = response.candidates[0].content.parts[0].inline_data.data
    if isinstance(pcm, str):  # SDK already base64-encoded
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
