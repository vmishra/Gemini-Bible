"""Grounding with Google Maps against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
Same exhaustive GenerateContentConfig form as text/basic — see that file
for the full per-knob rationale. Grounding-maps deviations:

  • tools=[Tool(google_maps=GoogleMaps())]
    Declares the Google Maps tool. The model issues place queries when
    the prompt is location-aware. Place results land on
    response.candidates[0].grounding_metadata.grounding_chunks[*].maps.
    https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-maps

  • tool_config.retrieval_config.lat_lng pinned to a caller location
    Without this, "near me" prompts have no geographic anchor. Pin to
    the actual caller location for deterministic place lookups.

  • safety_settings stay at default (None)
    Maps results are place names + URIs, not arbitrary article text —
    default safety thresholds rarely flag them. Unlike grounding-search
    we don't need BLOCK_NONE here.

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


# Downtown Los Angeles — substitute the user's actual location.
SAMPLE_LAT = 34.050481
SAMPLE_LNG = -118.248526


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
            # ---- Tools (the deviation) --------------------------------------
            tools=[types.Tool(google_maps=types.GoogleMaps())],
            tool_config=types.ToolConfig(
                retrieval_config=types.RetrievalConfig(
                    lat_lng=types.LatLng(latitude=SAMPLE_LAT, longitude=SAMPLE_LNG),
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
            safety_settings=None,       # default ON; maps results rarely trip the filter
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
        "lat_lng": {"latitude": SAMPLE_LAT, "longitude": SAMPLE_LNG},
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
