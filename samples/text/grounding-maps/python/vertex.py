"""Grounding with Google Maps against Vertex AI.

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
        contents=prompt
        or "What are the best Italian restaurants within a 15-minute walk from here?",
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_maps=types.GoogleMaps())],
            tool_config=types.ToolConfig(
                retrieval_config=types.RetrievalConfig(
                    lat_lng=types.LatLng(latitude=34.050481, longitude=-118.248526),
                ),
            ),
            thinking_config=_thinking_config(model, thinking_level),
        ),
    )

    metadata = (
        response.candidates[0].grounding_metadata
        if response.candidates and response.candidates[0].grounding_metadata
        else None
    )

    places: list[dict] = []
    if metadata:
        for chunk in getattr(metadata, "grounding_chunks", None) or []:
            maps = getattr(chunk, "maps", None)
            if maps is not None:
                places.append(
                    {
                        "title": getattr(maps, "title", None),
                        "uri": getattr(maps, "uri", None),
                        "place_id": getattr(maps, "placeId", None) or getattr(maps, "place_id", None),
                    }
                )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "places": places,
        "lat_lng": {"latitude": 34.050481, "longitude": -118.248526},
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
