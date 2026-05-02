"""Live API text round-trip against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Live is a bidirectional async session — open via client.aio.live.connect,
send turns with session.send_realtime_input, drain server events with
session.receive(). The session lives until you exit the context manager.

LiveConnectConfig surface is the largest of any Gemini API. Knobs grouped
by purpose; defaults preserved unless we have a specific reason to deviate.

  • response_modalities=["TEXT"]
    Text-only round-trip in this sample. ["AUDIO"] for voice-out;
    ["TEXT","AUDIO"] is not currently supported by Live.
    https://ai.google.dev/gemini-api/docs/live

  • input_audio_transcription / output_audio_transcription
    Both default off. Enable to receive a transcript of the audio side
    of the conversation as text events on the same stream — billed
    separately at the input/output text rate.

  • session_resumption
    Live sessions are stateful and can be resumed across reconnects via
    a server-issued handle. Default None (no resumption); set to
    SessionResumptionConfig(handle="…") to resume an existing session.

  • context_window_compression
    Once a session approaches the model's context limit, set
    ContextWindowCompressionConfig(...) to have the server summarise
    older turns automatically rather than dropping them.

  • Sampling knobs (temperature, top_p, top_k, max_output_tokens, seed)
    Live exposes the same sampling surface as generate_content. Defaults
    apply; set explicitly only when you have a use case for them.

  • Output handling
    Server events arrive as a stream. The structured shape is
    response.server_content.model_turn.parts[*].text for text deltas,
    and .output_transcription.text when transcription is enabled.
    response.server_content.turn_complete signals the end of a turn.
"""

import asyncio
import time

from google import genai
from google.genai import types


async def _run(model: str, prompt: str) -> dict:
    client = genai.Client()
    started = time.perf_counter()
    first_token_at: float | None = None
    pieces: list[str] = []

    async with client.aio.live.connect(
        model=model,
        config=types.LiveConnectConfig(
            # ---- Modality routing (the deviation) ---------------------------
            response_modalities=["TEXT"],
            # ---- Sampling (defaults preserved; surfaced for visibility) -----
            temperature=1.0,
            top_p=0.95,
            top_k=64,
            max_output_tokens=8192,
            seed=None,
            # ---- Audio transcription (default off) --------------------------
            input_audio_transcription=None,    # set InputAudioTranscriptionConfig() to enable
            output_audio_transcription=None,
            # ---- Session lifecycle (defaults) -------------------------------
            session_resumption=None,           # SessionResumptionConfig(handle=...) to resume
            context_window_compression=None,   # set when approaching context limit
            # ---- System / Safety (defaults) ---------------------------------
            system_instruction=None,
            safety_settings=None,
        ),
    ) as session:
        await session.send_realtime_input(text=prompt)

        async for response in session.receive():
            content = getattr(response, "server_content", None)
            if content is None:
                continue

            # Streaming text chunk via model_turn.parts (structured shape).
            model_turn = getattr(content, "model_turn", None)
            if model_turn is not None:
                for part in getattr(model_turn, "parts", None) or []:
                    text = getattr(part, "text", None)
                    if text:
                        if first_token_at is None:
                            first_token_at = time.perf_counter()
                        pieces.append(text)

            # Audio→text transcription shape (when input/output is audio).
            transcription = getattr(content, "output_transcription", None)
            if transcription and getattr(transcription, "text", None):
                if first_token_at is None:
                    first_token_at = time.perf_counter()
                pieces.append(transcription.text)

            if getattr(content, "turn_complete", False):
                break

    return {
        "text": "".join(pieces),
        "model": model,
        "__ttft_ms": round((first_token_at - started) * 1000, 2) if first_token_at else None,
        # Live sessions do not return aggregated usage_metadata in the
        # current SDK preview; per-modality token counts arrive on
        # session-end summary events that vary by model. Synthetic counts
        # below keep the host runner's accounting coherent.
        "usage_metadata": {
            "prompt_token_count": len(prompt.split()),
            "candidates_token_count": len("".join(pieces).split()),
            "total_token_count": len(prompt.split()) + len("".join(pieces).split()),
        },
    }


def main(model: str = "gemini-3.1-flash-live-preview", prompt: str | None = None) -> dict:
    return asyncio.run(
        _run(
            model=model,
            prompt=prompt or "In one sentence, what's the difference between half-duplex and full-duplex audio?",
        )
    )


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
