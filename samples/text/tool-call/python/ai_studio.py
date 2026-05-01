"""Function calling against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

The SDK introspects the function signatures and docstrings to build
the tool declaration. With automatic_function_calling on (default),
the SDK runs the call, feeds the result back to the model, and
returns the final natural-language answer in response.text.
"""

from google import genai
from google.genai import types


def get_current_temperature(location: str) -> dict:
    """Get the current temperature in Celsius for a given location.

    Args:
        location: City and country, e.g. "Bengaluru, India".
    """
    # Static stub for the demo; in production this would hit a weather API.
    fake_temps = {"Bengaluru, India": 28, "Reykjavik, Iceland": 4, "Cairo, Egypt": 36}
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

    response = client.models.generate_content(
        model=model,
        contents=prompt or "I'm flying to Reykjavik tonight — what should I pack?",
        config=types.GenerateContentConfig(
            tools=[get_current_temperature, get_packing_advice],
        ),
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "tools": ["get_current_temperature", "get_packing_advice"],
        "tool_calls": _count_tool_calls(response),
        "finish_reason": _finish_reason(response),
        "usage_metadata": usage.model_dump(mode="json") if usage else None,
    }


def _count_tool_calls(response) -> int:
    history = getattr(response, "automatic_function_calling_history", None) or []
    return sum(
        1
        for msg in history
        for part in getattr(msg, "parts", []) or []
        if getattr(part, "function_call", None) is not None
    )


def _finish_reason(response) -> str | None:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return None
    fr = getattr(candidates[0], "finish_reason", None)
    return getattr(fr, "name", str(fr)) if fr else None


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
