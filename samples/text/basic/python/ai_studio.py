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
        "usage": {
            "prompt_tokens": getattr(usage, "prompt_token_count", None),
            "output_tokens": getattr(usage, "candidates_token_count", None),
            "thinking_tokens": getattr(usage, "thoughts_token_count", None),
            "cached_tokens": getattr(usage, "cached_content_token_count", None),
            "total_tokens": getattr(usage, "total_token_count", None),
        },
    }


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2))
