"""Grounding with Google Search against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Pattern: declare types.Tool(google_search=types.GoogleSearch()) and pass
it via config.tools. The model decides when to issue web queries.
Sources land on response.candidates[0].grounding_metadata.

Thinking: Gemini 3.x and 2.5 generate internal reasoning tokens by default.
3.x uses thinking_level ∈ {minimal, low, medium, high}, default "high";
2.5 uses thinking_budget int (-1 dynamic, 0 off on Flash). Set explicitly.
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
        contents=prompt
        or "What is the most recent stable release of PostgreSQL and the headline change in it?",
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
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
