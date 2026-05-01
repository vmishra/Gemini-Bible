"""Basic text generation against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment — picked up by Client() automatically.
"""

from google import genai


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt or "Explain transformers to a senior backend engineer in three sentences.",
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "finish_reason": _finish_reason(response),
        # Full usage_metadata dump — the host runner extracts modality
        # breakdowns, thinking tokens, cache details from this.
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
