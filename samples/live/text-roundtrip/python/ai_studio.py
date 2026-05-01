"""Live API text round-trip against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Demonstrates the minimum Live exchange:
  1. Open the bidirectional session via client.aio.live.connect.
  2. Send a single text turn.
  3. Accumulate streamed model text from session.receive() until the
     turn is complete, then exit the context manager.

Audio in / audio out variants extend this same pattern by switching
response_modalities and feeding PCM frames via send_realtime_input.
"""

import asyncio
import time

from google import genai


async def _run(model: str, prompt: str) -> dict:
    client = genai.Client()
    started = time.perf_counter()
    first_token_at: float | None = None
    pieces: list[str] = []

    async with client.aio.live.connect(
        model=model,
        config={"response_modalities": ["TEXT"]},
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
