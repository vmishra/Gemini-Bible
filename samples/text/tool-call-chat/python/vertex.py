"""Function calling inside a chat session — Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.

Thinking: Gemini 3.x and 2.5 generate internal reasoning tokens by default.
3.x uses thinking_level ∈ {minimal, low, medium, high}, default "high";
2.5 uses thinking_budget int (-1 dynamic, 0 off on Flash). Set explicitly.
"""

import os

from google import genai
from google.genai import types


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level=level)
    return types.ThinkingConfig(thinking_budget=-1)


def get_current_temperature(location: str) -> dict:
    """Get the current temperature in Celsius for a given location.

    Args:
        location: City and country, e.g. "Bengaluru, India".
    """
    fake_temps = {
        "Bengaluru, India": 28,
        "Reykjavik, Iceland": 4,
        "Cairo, Egypt": 36,
        "Tokyo, Japan": 18,
    }
    return {"location": location, "temperature_c": fake_temps.get(location, 22)}


def get_packing_advice(temperature_c: float) -> dict:
    """Suggest one-line packing advice for a given temperature in Celsius."""
    if temperature_c < 5:
        advice = "Insulated jacket, warm gloves, layers."
    elif temperature_c < 18:
        advice = "Light jacket and a long-sleeve shirt."
    elif temperature_c < 28:
        advice = "Comfortable shirt, breathable trousers."
    else:
        advice = "Lightweight cottons, sun protection."
    return {"temperature_c": temperature_c, "advice": advice}


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
            tools=[get_current_temperature, get_packing_advice],
            system_instruction=(
                "You are a terse travel assistant. When asked about a city, call the "
                "weather and packing tools before answering. Keep answers under three sentences."
            ),
            thinking_config=_thinking_config(model, thinking_level),
        ),
    )

    script = (
        [prompt]
        if prompt
        else [
            "I'm flying to Reykjavik tonight — what should I pack?",
            "And what about Cairo next week?",
        ]
    )

    aggregated = {
        "prompt_token_count": 0,
        "cached_content_token_count": 0,
        "candidates_token_count": 0,
        "thoughts_token_count": 0,
        "tool_use_prompt_token_count": 0,
    }

    turns: list[dict] = []
    history_seen = 0
    last_response = None

    for message in script:
        last_response = chat.send_message(message)

        history = getattr(last_response, "automatic_function_calling_history", None) or []
        new_history = history[history_seen:]
        history_seen = len(history)
        turn_calls = [
            {
                "name": part.function_call.name,
                "args": dict(part.function_call.args or {}),
            }
            for msg in new_history
            for part in (getattr(msg, "parts", None) or [])
            if getattr(part, "function_call", None) is not None
        ]

        usage = last_response.usage_metadata
        usage_dump = usage.model_dump(mode="json") if usage else None
        if usage_dump:
            for k in aggregated:
                aggregated[k] += usage_dump.get(k) or 0

        turns.append(
            {
                "user": message,
                "model": last_response.text,
                "tool_calls": turn_calls,
                "usage": usage_dump,
            }
        )

    return {
        "text": last_response.text if last_response else "",
        "model": model,
        "tools": ["get_current_temperature", "get_packing_advice"],
        "tool_calls": sum(len(t["tool_calls"]) for t in turns),
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
