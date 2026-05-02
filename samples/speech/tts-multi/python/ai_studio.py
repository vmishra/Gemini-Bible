"""TTS — multi-speaker dialogue — against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Multi-speaker mode swaps speech_config.voice_config for
speech_config.multi_speaker_voice_config. The two are mutually exclusive —
setting both raises. See speech/tts-single for the single-voice form.

  • response_modalities=["AUDIO"]
    Same as tts-single — switches the model to audio output.

  • speech_config.multi_speaker_voice_config.speaker_voice_configs
    A list of (speaker_label, voice_config) pairs. The speaker labels in
    the prompt body must match these labels exactly ("Joe:" / "Jane:" in
    the dialogue script below). Bracketed direction cues ("[excitedly]")
    inflect the same voice; they do NOT switch speakers.
    https://ai.google.dev/gemini-api/docs/speech-generation#multi-speaker

  • Voice catalog
    Each speaker entry uses a PrebuiltVoiceConfig with a voice_name. Pick
    distinct voices for distinct speakers — the model does not enforce
    uniqueness and will happily render two speakers with the same voice.

  • Output format
    Same as tts-single: raw 24 kHz mono 16-bit PCM, wrapped in WAV.
"""

import base64
import io
import wave

from google import genai
from google.genai import types

DIALOGUE = (
    "TTS the following short conversation between Joe and Jane:\n"
    "Joe: Did you see the new model lineup?\n"
    "Jane: I did. The lite tier is genuinely cheap now — we should A/B it on the routing path.\n"
    "Joe [excitedly]: Let's draft the experiment plan today.\n"
    "Jane: Agreed."
)


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
) -> dict:
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt or DIALOGUE,
        config=types.GenerateContentConfig(
            # ---- Modality routing (the deviation) ---------------------------
            response_modalities=["AUDIO"],
            # ---- Multi-speaker voices ---------------------------------------
            speech_config=types.SpeechConfig(
                multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                    speaker_voice_configs=[
                        types.SpeakerVoiceConfig(
                            speaker="Joe",
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore"),
                            ),
                        ),
                        types.SpeakerVoiceConfig(
                            speaker="Jane",
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck"),
                            ),
                        ),
                    ],
                ),
                language_code="en-US",     # explicit; defaults to inferred
            ),
            # ---- Safety / Determinism (defaults) ----------------------------
            safety_settings=None,
            seed=None,
        ),
    )

    pcm = response.candidates[0].content.parts[0].inline_data.data
    if isinstance(pcm, str):
        pcm = base64.b64decode(pcm)
    wav_bytes = _wrap_pcm_as_wav(pcm)

    usage = response.usage_metadata
    return {
        "text": f"Generated {len(pcm):,} bytes of dialogue PCM ({len(pcm) / (24000 * 2):.2f} s).",
        "model": model,
        "speakers": [
            {"label": "Joe", "voice": "Kore"},
            {"label": "Jane", "voice": "Puck"},
        ],
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
