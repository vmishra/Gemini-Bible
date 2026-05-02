"""Function calling against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. Tool-call deviations:

  • tools=[python_function, ...]
    The SDK introspects the function signature, type hints, and docstring
    to build a tool declaration automatically. The explicit form is
    types.Tool(function_declarations=[FunctionDeclaration(name=...,
    description=..., parameters=...)]) — use it when you need fields the
    introspection can't infer, otherwise prefer the Pythonic form.
    https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling

  • tool_config=ToolConfig(function_calling_config=FunctionCallingConfig(mode="AUTO"))
    Modes: AUTO (model decides; default), ANY (forces a function call),
    NONE (disables tool use even if declared).

  • automatic_function_calling default ON
    With AFC enabled (the default), the SDK runs the function, feeds the
    result back, and returns the final natural-language answer in
    response.text.

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


def get_current_temperature(location: str) -> dict:
    """Get the current temperature in Celsius for a given location.

    Args:
        location: City and country, e.g. "Bengaluru, India".
    """
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

    response = client.models.generate_content(
        model=model,
        contents=prompt or "I'm flying to Reykjavik tonight — what should I pack?",
        config=types.GenerateContentConfig(
            # ---- Tools (the deviation) --------------------------------------
            tools=[get_current_temperature, get_packing_advice],
            tool_config=types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(
                    mode="AUTO",   # default; ANY forces a call, NONE disables
                ),
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

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "tools": ["get_current_temperature", "get_packing_advice"],
        "tool_calls": _count_tool_calls(response),
        "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
        "thinking_value": thinking_level if model.startswith("gemini-3") else -1,
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
