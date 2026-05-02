"""Streaming text generation against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. Streaming-specific patterns:

  • generate_content_stream returns an iterator of partial response chunks.
    Each chunk carries .text (incremental) and (on the final chunk only)
    .usage_metadata. Concatenate text in order; treat usage as authoritative
    only when present.
    https://ai.google.dev/gemini-api/docs/text-generation#streaming

  • Time-to-first-token (TTFT) is what users perceive as latency. We capture
    it on the first non-empty chunk and surface it as `__ttft_ms` so the
    host runner separates it from total generation time in the metrics
    ribbon.

  • max_output_tokens=2048 (down from the model default ~8192)
    For streaming demos and chat UIs the perceived experience improves when
    the response is bounded — a long-running stream feels worse than a
    snappy short answer. Raise for long-form generation.

  • thinking_level="medium" (Gemini 3.x default is "high")
    Same rationale as text/basic.
"""

import time

from google import genai
from google.genai import types


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    """Routes the thinking knob to the right field per family.

    Gemini 3.x → thinking_level (string enum, default "high").
    Gemini 2.5 → thinking_budget (int token cap, -1 dynamic default).
    """
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
            # ---- Sampling ---------------------------------------------------
            temperature=1.0,            # default 1.0; raise for creative, lower for JSON
            top_p=0.95,                 # default 0.95
            top_k=64,                   # default 64 on Gemini 3.x (was 40 on 2.5)
            candidate_count=1,          # default 1; >1 not supported on Gemini 3.x
            max_output_tokens=2048,     # ↓ from default for snappier perceived TTFT
            # ---- Stop / Output / Safety / Determinism (defaults) ------------
            stop_sequences=None,
            response_mime_type="text/plain",
            safety_settings=None,
            seed=None,
            # ---- Reasoning --------------------------------------------------
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
        # Surfaced to the host runner so per-run telemetry separates TTFT
        # from total generation time.
        "__ttft_ms": round((first_token_at - started) * 1000, 2) if first_token_at else None,
    }


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
