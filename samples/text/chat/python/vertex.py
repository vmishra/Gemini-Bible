"""Multi-turn chat against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. Chat-specific patterns:

  • Configure once at chats.create, not per send_message
    The Chat object holds both history and config. Anything passed via
    `config=` on chats.create applies to every subsequent send_message,
    so put the knob block there. send_message takes overrides only when
    you genuinely need turn-specific tweaks.
    https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/multi-turn-conversations

  • Per-turn input_tokens grows with conversation length
    The model sees the full accumulated history every turn. Aggregate
    usage_metadata across turns to get the total billed tokens.

  • thinking_level="medium" (Gemini 3.x default is "high")
    Same rationale as text/basic.
"""

import os

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
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )
    chat = client.chats.create(
        model=model,
        config=types.GenerateContentConfig(
            # ---- Sampling ---------------------------------------------------
            temperature=1.0,            # default 1.0; raise for creative, lower for JSON
            top_p=0.95,                 # default 0.95
            top_k=64,                   # default 64 on Gemini 3.x (was 40 on 2.5)
            candidate_count=1,          # default 1; >1 not supported on Gemini 3.x
            max_output_tokens=8192,     # default model-dependent; cap to bound spend
            # ---- Stop / Output / Safety / Determinism (defaults) ------------
            stop_sequences=None,
            response_mime_type="text/plain",
            safety_settings=None,
            seed=None,
            # ---- Reasoning --------------------------------------------------
            thinking_config=_thinking_config(model, thinking_level),
        ),
    )

    turns: list[dict] = []
    aggregated = {
        "prompt_token_count": 0,
        "cached_content_token_count": 0,
        "candidates_token_count": 0,
        "thoughts_token_count": 0,
    }

    script = (
        [prompt] if prompt
        else [
            "I'm benchmarking three vector databases on the same workload.",
            "Which one should I weigh hardest on recall vs. p99 latency for a chat-history use case?",
        ]
    )

    last_response = None
    for message in script:
        last_response = chat.send_message(message)
        usage = last_response.usage_metadata
        turn_record = {"user": message, "model": last_response.text, "usage": None}
        if usage:
            dump = usage.model_dump(mode="json")
            turn_record["usage"] = dump
            for k in aggregated:
                aggregated[k] += dump.get(k) or 0
        turns.append(turn_record)

    return {
        "text": last_response.text if last_response else "",
        "model": model,
        "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
        "thinking_value": thinking_level if model.startswith("gemini-3") else -1,
        "turns": turns,
        "usage_metadata": aggregated,
        "finish_reason": _finish_reason(last_response) if last_response else None,
    }


def _finish_reason(response) -> str | None:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return None
    fr = getattr(candidates[0], "finish_reason", None)
    return getattr(fr, "name", str(fr)) if fr else None


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
