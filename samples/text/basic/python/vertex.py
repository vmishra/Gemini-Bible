"""Basic text generation against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
This is the reference-grade form: every documented GenerateContentConfig knob
is shown with its current default. Where we deviate from default, an inline
comment says why and links to the relevant Google doc. The premise is that a
reader should never have to ask "what is this set to?" — the surface area of
the API is visible at a glance.

Family-level patterns at play here:

  • thinking_level="medium" (Gemini 3.x default is "high")
    The default doubles output cost on simple prompts with no measurable
    quality gain on benchmarks below MMLU-Pro 90. We only spend "high" on
    samples whose entire purpose is to demonstrate deep reasoning (see
    text/thinking). For everything else, "medium" is the responsible default.
    https://cloud.google.com/vertex-ai/generative-ai/docs/thinking

  • temperature=1.0 (default) preserved
    Plain text generation benefits from the model's native distribution.
    Lower temperatures only help when the output schema is rigid (see
    text/structured-output, where temperature drops to 0.2 for JSON
    consistency).

  • safety_settings=None (defaults ON) preserved
    Gemini's default safety thresholds are the right call for unguided text
    generation. Samples that explicitly need BLOCK_NONE — typically grounding
    samples where the search results themselves are not under the model's
    control — set this knob non-default with rationale (see text/grounding-
    search).
"""

import os

from google import genai
from google.genai import types


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    """Routes the thinking knob to the right field per family.

    Gemini 3.x uses thinking_level: {"minimal","low","medium","high"} —
                 string enum, easy to reason about, default "high".
    Gemini 2.5 uses thinking_budget: int token cap. -1 means dynamic
                 (default), 0 turns thinking off, positive ints cap it.

    Mirrors the helper in every text sample so reading any one of them
    teaches the full thinking-config story.
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

    response = client.models.generate_content(
        model=model,
        contents=prompt or "Explain transformers to a senior backend engineer in three sentences.",
        config=types.GenerateContentConfig(
            # ---- Sampling ---------------------------------------------------
            # Sampling knobs compose: temperature rescales logits first, then
            # top_p (nucleus filter), then top_k (hard cap on candidates).
            # Tightening any one reduces variance; tightening multiple compounds.
            temperature=1.0,            # default 1.0; raise for creative, lower for JSON
            top_p=0.95,                 # default 0.95; nucleus sampling threshold
            top_k=64,                   # default 64 on Gemini 3.x (was 40 on 2.5)
            candidate_count=1,          # default 1; >1 not supported on Gemini 3.x
            max_output_tokens=8192,     # default model-dependent; cap to bound spend
            # ---- Stop conditions --------------------------------------------
            # stop_sequences match decoded text, not tokens — they survive
            # tokenizer differences across model versions.
            stop_sequences=None,        # default None; e.g. ["\n\n", "###"] to halt early
            # ---- Reasoning --------------------------------------------------
            # See WHY THIS SHAPE for the family-level rationale. Helper routes
            # to thinking_level on Gemini 3.x and thinking_budget on 2.5; both
            # are billed at the *output* token rate.
            thinking_config=_thinking_config(model, thinking_level),
            # ---- Output shape -----------------------------------------------
            # response_mime_type + response_schema together opt the model into
            # structured-output mode. text/plain is the default.
            response_mime_type="text/plain",  # default; "application/json" pairs with schema
            # ---- Safety -----------------------------------------------------
            # Defaults block clear violations across HARM_CATEGORY_{HARASSMENT,
            # HATE_SPEECH, SEXUALLY_EXPLICIT, DANGEROUS_CONTENT}. Override per-
            # category only with reason — see text/grounding-search.
            safety_settings=None,       # default ON
            # ---- Determinism ------------------------------------------------
            # A seed makes the model deterministic for a given (prompt, config,
            # model_version) tuple. Indispensable for evals; not for end-users.
            seed=None,                  # default None; set int for repro runs
        ),
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
        "thinking_value": thinking_level if model.startswith("gemini-3") else -1,
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
