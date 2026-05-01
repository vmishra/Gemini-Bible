"""Streaming text generation against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Notes:
  - generate_content_stream returns an iterator of GenerateContentResponse chunks.
  - Each chunk carries a partial `text`. Concatenate to assemble the response.
  - usage_metadata is reliably populated on the final chunk only.

Thinking: Gemini 3.x and 2.5 generate internal reasoning tokens by default
(billed at the output rate). 3.x uses thinking_level ∈ {minimal, low, medium,
high}, default "high"; 2.5 uses thinking_budget int (-1 dynamic, 0 off).
We pass thinking_config explicitly so the knob is visible.
"""

import time

from google import genai
from google.genai import types


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level=level)
    return types.ThinkingConfig(thinking_budget=-1)


def main(
    model: str = "gemini-3-flash-preview",
    prompt: str | None = None,
    thinking_level: str = "medium",
) -> dict:
    client = genai.Client()

    started = time.perf_counter()
    first_token_at: float | None = None
    pieces: list[str] = []
    final_usage = None
    final_finish_reason = None

    stream = client.models.generate_content_stream(
        model=model,
        contents=prompt or "Write a haiku about a cold start in serverless inference.",
        config=types.GenerateContentConfig(
            thinking_config=_thinking_config(model, thinking_level),
        ),
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
        "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
        "thinking_value": thinking_level if model.startswith("gemini-3") else -1,
        "finish_reason": final_finish_reason,
        "usage_metadata": final_usage.model_dump(mode="json") if final_usage else None,
        # Surfaced to the host runner so per-run telemetry separates TTFT from total.
        "__ttft_ms": round((first_token_at - started) * 1000, 2) if first_token_at else None,
    }


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
