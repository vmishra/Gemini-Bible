"""Basic text generation against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical.
"""

import os

from google import genai


def main(model: str = "gemini-2.5-flash", prompt: str | None = None) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

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
