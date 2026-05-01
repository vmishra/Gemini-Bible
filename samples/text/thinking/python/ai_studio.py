"""Thinking budget against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Picks the right knob automatically:
  - Gemini 3.x  → thinking_level (minimal/low/medium/high)
  - Gemini 2.5  → thinking_budget (int; -1 dynamic, 0 disabled)
"""

from google import genai
from google.genai import types


def _build_thinking_config(model: str) -> types.ThinkingConfig:
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level="medium")
    return types.ThinkingConfig(thinking_budget=2048)


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or (
            "A queue is silently dropping ~1% of messages between the producer "
            "and consumer. Acks look fine on both sides. Where do I look first?"
        ),
        config=types.GenerateContentConfig(thinking_config=_build_thinking_config(model)),
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
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

    print(json.dumps(main(), indent=2, default=str))
