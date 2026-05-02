"""Explicit context caching against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. Context-cache deviations:

  • Two-step flow: caches.create (with the prefix), then generate_content
    with config.cached_content = cache.name. The cache holds the prefix
    tokens at a discounted rate; per-call requests pay only for the tail.
    Watch usage_metadata.cached_content_token_count climb on the second call.
    https://ai.google.dev/gemini-api/docs/caching

  • caches.create config: display_name, system_instruction, contents, ttl
    The TTL governs the cache lifetime. Caches keep billing for their TTL
    even if unused — always delete in a try/finally if you're spinning
    them up dynamically.

  • Minimum cacheable size
    The prefix needs to clear the model's minimum cacheable threshold
    (~1024 tokens on Flash, more on Pro). Below that, the create call
    succeeds but the cache is silently inert. Real workloads inflate
    with a real document; this sample uses ~30K tokens of repetition.

  • thinking_level="medium" (Gemini 3.x default is "high")
    Same rationale as text/basic.
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

# A long-enough prefix to clear the minimum cacheable size. Real workloads
# would substitute a real document, transcript, or codebase summary.
PREFIX = (
    "ARCHITECTURE NOTES — INTERNAL\n"
    "============================\n\n"
    "The platform exposes a federated query layer that routes per-tenant "
    "reads through one of three storage tiers (hot Spanner, warm Bigtable, "
    "cold GCS Parquet) based on a tier policy evaluated at session start. "
) * 600  # ~30K tokens of repetitive text — enough to be cacheable.


def main(
    model: str = "gemini-3-flash-preview",
    prompt: str | None = None,
    thinking_level: str = "medium",
) -> dict:
    client = genai.Client()

    cache = client.caches.create(
        model=model,
        config=types.CreateCachedContentConfig(
            display_name="gemini-bible-demo-cache",
            system_instruction=(
                "You are an internal staff engineer. Answer using only the "
                "architecture notes provided. If the notes don't cover the "
                "question, say so."
            ),
            contents=[PREFIX],
            ttl="120s",   # cache evicts after 2 minutes; raise for longer-lived prefixes
        ),
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt
            or "Which storage tier handles cold analytics queries, and how is the tier chosen?",
            config=types.GenerateContentConfig(
                # ---- Cache binding (the deviation) --------------------------
                # Reference the cache by name; the prefix tokens are billed at
                # the cached-input rate (much lower than fresh input).
                cached_content=cache.name,
                # ---- Sampling -----------------------------------------------
                temperature=1.0,            # default 1.0; raise for creative, lower for JSON
                top_p=0.95,                 # default 0.95
                top_k=64,                   # default 64 on Gemini 3.x (was 40 on 2.5)
                candidate_count=1,          # default 1; >1 not supported on Gemini 3.x
                max_output_tokens=8192,     # default model-dependent; cap to bound spend
                # ---- Stop / Output / Safety / Determinism (defaults) --------
                stop_sequences=None,
                response_mime_type="text/plain",
                safety_settings=None,
                seed=None,
                # ---- Reasoning ----------------------------------------------
                thinking_config=_thinking_config(model, thinking_level),
            ),
        )

        usage = response.usage_metadata
        return {
            "text": response.text,
            "model": model,
            "cache_name": cache.name,
            "cache_token_count": getattr(cache.usage_metadata, "total_token_count", None)
            if getattr(cache, "usage_metadata", None)
            else None,
            "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
            "thinking_value": thinking_level if model.startswith("gemini-3") else -1,
            "finish_reason": _finish_reason(response),
            "usage_metadata": usage.model_dump(mode="json") if usage else None,
        }
    finally:
        # Always clean up — caches keep billing for their TTL even if unused.
        client.caches.delete(name=cache.name)


def _finish_reason(response) -> str | None:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return None
    fr = getattr(candidates[0], "finish_reason", None)
    return getattr(fr, "name", str(fr)) if fr else None


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
