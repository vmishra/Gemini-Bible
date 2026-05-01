"""Basic text generation against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment — picked up by Client() automatically.

Thinking: Gemini 3.x and 2.5 generate internal reasoning tokens by default,
billed at the *output* rate. The two families take different knobs:

  Gemini 3.x   thinking_level ∈ {"minimal", "low", "medium", "high"}
                Default is "high". Pick "medium" or "low" to cap cost.
  Gemini 2.5   thinking_budget — int token cap; -1 dynamic (default), 0 off.

We pass an explicit thinking_config so the knob is visible to readers.
"""

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

    response = client.models.generate_content(
        model=model,
        contents=prompt or "Explain transformers to a senior backend engineer in three sentences.",
        config=types.GenerateContentConfig(
            thinking_config=_thinking_config(model, thinking_level),
        ),
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
        "thinking_value": thinking_level if model.startswith("gemini-3") else -1,
        "finish_reason": _finish_reason(response),
        # Full usage_metadata dump — the host runner extracts modality
        # breakdowns, thinking tokens, cache details from this.
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
