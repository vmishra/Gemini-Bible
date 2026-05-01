"""Function calling inside a chat session — Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Tools declared once on chats.create persist across every send_message.
Automatic function calling stays on across the conversation, and the
call history accumulates on the response — index from the previous
turn's length to count calls per turn.
"""

from google import genai
from google.genai import types


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


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client()

    chat = client.chats.create(
        model=model,
        config=types.GenerateContentConfig(
            tools=[get_current_temperature, get_packing_advice],
            system_instruction=(
                "You are a terse travel assistant. When asked about a city, call the "
                "weather and packing tools before answering. Keep answers under three sentences."
            ),
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

        # Calls in *this* turn are the slice of automatic_function_calling_history
        # added since the previous turn ended.
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
