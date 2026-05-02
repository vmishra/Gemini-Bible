"""Thinking budget — the showcase — against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. This sample is the *showcase* for the
thinking knobs, so it deviates from the project default in two ways:

  • thinking_level="high" (the showcase value)
    Every other text sample uses "medium" to cap reasoning cost. This one
    cranks it to "high" because the prompt is genuinely a multi-step
    debugging puzzle where the extra reasoning tokens earn their cost.
    Try the same prompt at "medium" or "low" to see the quality drop.
    https://ai.google.dev/gemini-api/docs/thinking

  • include_thoughts=True (Gemini 3.x only — silently ignored on 2.5)
    Surfaces the model's intermediate reasoning trace as Thought parts on
    the response. Read response.candidates[0].content.parts and dispatch
    on Part.thought (vs Part.text) to render them. The trace is billed at
    the thinking-token rate; see usage_metadata.thoughts_token_count.

  • For Gemini 2.5: thinking_budget=2048 (a meaningful int cap)
    The 2.5 family uses an integer budget instead of a level enum. 2048
    tokens is a reasonable showcase budget — enough for a multi-hop
    reasoning chain without runaway spend.
"""

from google import genai
from google.genai import types


def _build_thinking_config(model: str) -> types.ThinkingConfig:
    """Showcase config — opts into the *most* reasoning the family allows.

    Gemini 3.x → thinking_level="high" + include_thoughts=True
    Gemini 2.5 → thinking_budget=2048 (include_thoughts honored on 2.5 too)
    """
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level="high", include_thoughts=True)
    return types.ThinkingConfig(thinking_budget=2048, include_thoughts=True)


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or (
            "A queue is silently dropping ~1% of messages between the producer "
            "and consumer. Acks look fine on both sides. Where do I look first?"
        ),
        config=types.GenerateContentConfig(
            # ---- Reasoning (the deviation) ----------------------------------
            thinking_config=_build_thinking_config(model),
            # ---- Sampling ---------------------------------------------------
            temperature=1.0,            # default 1.0; preserved — reasoning benefits from variance
            top_p=0.95,                 # default 0.95
            top_k=64,                   # default 64 on Gemini 3.x (was 40 on 2.5)
            candidate_count=1,          # default 1; >1 not supported on Gemini 3.x
            max_output_tokens=8192,     # default model-dependent; cap to bound spend
            # ---- Stop / Output / Safety / Determinism (defaults) ------------
            stop_sequences=None,
            response_mime_type="text/plain",
            safety_settings=None,
            seed=None,
        ),
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
