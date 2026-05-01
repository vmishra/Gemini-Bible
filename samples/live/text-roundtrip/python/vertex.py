"""Live API text round-trip against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.
"""

import asyncio
import os
import time

from google import genai


async def _run(model: str, prompt: str) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )
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

            model_turn = getattr(content, "model_turn", None)
            if model_turn is not None:
                for part in getattr(model_turn, "parts", None) or []:
                    text = getattr(part, "text", None)
                    if text:
                        if first_token_at is None:
                            first_token_at = time.perf_counter()
                        pieces.append(text)

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
