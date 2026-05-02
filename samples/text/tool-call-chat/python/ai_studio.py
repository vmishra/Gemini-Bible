"""Function calling inside a chat session — Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Combines text/chat (config on chats.create) and text/tool-call (tools list,
tool_config, AFC) — see those files for the per-pattern rationale.
Tool-call-chat-specific notes:

  • Tools declared once on chats.create persist across every send_message
    in the session. No need to repeat them per turn.

  • automatic_function_calling_history accumulates on the response across
    turns; slice from the previous turn's length to count calls per turn.
    https://ai.google.dev/gemini-api/docs/function-calling#chat

  • system_instruction set once at chats.create; carries through every
    turn just like the tools list.

  • thinking_level="medium" (Gemini 3.x default is "high")
    Same rationale as text/basic. Tool-using chat turns rarely need "high"
    — the function results often shortcut the reasoning that "high" buys.
"""

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
    client = genai.Client()

    chat = client.chats.create(
        model=model,
        config=types.GenerateContentConfig(
            # ---- Tools (the deviation, set once for the whole session) ------
            tools=[get_current_temperature, get_packing_advice],
            tool_config=types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(
                    mode="AUTO",   # default; ANY forces a call, NONE disables
                ),
            ),
            # ---- Persona ----------------------------------------------------
            system_instruction=(
                "You are a terse travel assistant. When asked about a city, call the "
                "weather and packing tools before answering. Keep answers under three sentences."
            ),
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
