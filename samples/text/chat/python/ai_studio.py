"""Multi-turn chat against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

The Chat object holds the message history between calls. Each
send_message issues one model call against the full accumulated
history, so per-turn input_tokens grows with the conversation length.

Thinking
--------
Gemini 3.x and 2.5 generate internal reasoning tokens by default.
Pricing-wise, those tokens land at the *output* rate, so the level
matters. The two families take different knobs:

  Gemini 3.x   thinking_level ∈ {"minimal", "low", "medium", "high"}
                Default is "high". Pick "medium" or "low" to cap reasoning
                cost on chat-style turns; "minimal" disables on Flash.
  Gemini 2.5   thinking_budget — integer token cap, -1 enables dynamic
                thinking (default), 0 disables on Flash.

We pass an explicit `thinking_config` on `chats.create` so the knob
is visible to readers — the same config carries across every
send_message in the session.
"""

from google import genai
from google.genai import types


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    """Pick the right thinking knob for the model family."""
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level=level)
    # Gemini 2.5 family: use the integer budget instead of the level enum.
    # -1 lets the model decide dynamically; 0 disables on Flash.
    return types.ThinkingConfig(thinking_budget=-1)


def main(
    model: str = "gemini-3-flash-preview",
    prompt: str | None = None,
    thinking_level: str = "medium",
) -> dict:
    client = genai.Client()
    chat = client.chats.create(
        model=model,
        config=types.GenerateContentConfig(
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
        # Aggregated across the conversation — these are the tokens you actually billed for.
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
