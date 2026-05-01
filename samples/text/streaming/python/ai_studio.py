"""Streaming text generation against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Notes:
  - generate_content_stream returns an iterator of GenerateContentResponse chunks.
  - Each chunk carries a partial `text`. Concatenate to assemble the response.
  - usage_metadata is reliably populated on the final chunk only.
"""

import time

from google import genai


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client()

    started = time.perf_counter()
    first_token_at: float | None = None
    pieces: list[str] = []
    final_usage = None
    final_finish_reason = None

    stream = client.models.generate_content_stream(
        model=model,
        contents=prompt or "Write a haiku about a cold start in serverless inference.",
    )
    for chunk in stream:
        if first_token_at is None and chunk.text:
            first_token_at = time.perf_counter()
        if chunk.text:
            pieces.append(chunk.text)
        if chunk.usage_metadata is not None:
            final_usage = chunk.usage_metadata
        if chunk.candidates and chunk.candidates[0].finish_reason is not None:
            fr = chunk.candidates[0].finish_reason
            final_finish_reason = getattr(fr, "name", str(fr))

    return {
        "text": "".join(pieces),
        "model": model,
        "finish_reason": final_finish_reason,
        "usage_metadata": final_usage.model_dump(mode="json") if final_usage else None,
        # Surfaced to the host runner so per-run telemetry separates TTFT from total.
        "__ttft_ms": round((first_token_at - started) * 1000, 2) if first_token_at else None,
    }


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
