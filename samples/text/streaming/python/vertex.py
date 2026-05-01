"""Streaming text generation against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.
"""

import os
import time

from google import genai


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

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
        "__ttft_ms": round((first_token_at - started) * 1000, 2) if first_token_at else None,
    }


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
