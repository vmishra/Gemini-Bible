"""Grounding with Google Search against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. Grounding-search deviations:

  • tools=[Tool(google_search=GoogleSearch())]
    Declares the Google Search tool. The model decides per turn whether
    to issue web queries; if it does, sources land on
    response.candidates[0].grounding_metadata.{web_search_queries,
    grounding_chunks[*].web}. Always cite — Google's terms require
    surfacing the source URIs in the UI alongside the answer.
    https://ai.google.dev/gemini-api/docs/grounding

  • safety_settings → BLOCK_NONE across all four harm categories
    Search results contain text the model didn't author. Default safety
    thresholds will sometimes block grounded answers because of phrasing
    in a *source page* the model summarised. BLOCK_NONE here means "trust
    the search corpus and the cite-the-source pattern as the safety
    layer." Revert if you have stricter compliance requirements.

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


def _grounding_safety() -> list[types.SafetySetting]:
    """BLOCK_NONE across the four documented harm categories. See WHY."""
    return [
        types.SafetySetting(category=cat, threshold="BLOCK_NONE")
        for cat in (
            "HARM_CATEGORY_HARASSMENT",
            "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "HARM_CATEGORY_DANGEROUS_CONTENT",
        )
    ]


def main(
    model: str = "gemini-3-flash-preview",
    prompt: str | None = None,
    thinking_level: str = "medium",
) -> dict:
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt
        or "What is the most recent stable release of PostgreSQL and the headline change in it?",
        config=types.GenerateContentConfig(
            # ---- Tools (the deviation) --------------------------------------
            tools=[types.Tool(google_search=types.GoogleSearch())],
            # ---- Safety (the second deviation) ------------------------------
            safety_settings=_grounding_safety(),
            # ---- Sampling ---------------------------------------------------
            temperature=1.0,            # default 1.0; raise for creative, lower for JSON
            top_p=0.95,                 # default 0.95
            top_k=64,                   # default 64 on Gemini 3.x (was 40 on 2.5)
            candidate_count=1,          # default 1; >1 not supported on Gemini 3.x
            max_output_tokens=8192,     # default model-dependent; cap to bound spend
            # ---- Stop / Output / Determinism (defaults) ---------------------
            stop_sequences=None,
            response_mime_type="text/plain",
            seed=None,
            # ---- Reasoning --------------------------------------------------
            thinking_config=_thinking_config(model, thinking_level),
        ),
    )

    metadata = (
        response.candidates[0].grounding_metadata
        if response.candidates and response.candidates[0].grounding_metadata
        else None
    )

    sources: list[dict] = []
    queries: list[str] = []
    if metadata:
        queries = list(getattr(metadata, "web_search_queries", None) or [])
        for chunk in getattr(metadata, "grounding_chunks", None) or []:
            web = getattr(chunk, "web", None)
            if web is not None:
                sources.append(
                    {
                        "uri": getattr(web, "uri", None),
                        "title": getattr(web, "title", None),
                    }
                )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "search_queries": queries,
        "sources": sources,
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
