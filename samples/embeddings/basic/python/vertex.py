"""Text embeddings against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.
"""

import os

from google import genai
from google.genai import types


def main(model: str = "gemini-embedding-2", prompt: str | None = None) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )

    snippets = (
        [prompt]
        if prompt
        else [
            "A federated query layer routes reads across hot, warm, and cold storage tiers.",
            "The platform retains personally identifiable information for 30 days.",
            "Cold queries land in Parquet files on object storage.",
        ]
    )

    result = client.models.embed_content(
        model=model,
        contents=snippets,
        config=types.EmbedContentConfig(output_dimensionality=768),
    )

    vectors = []
    for embedding in result.embeddings:
        values = embedding.values
        vectors.append(
            {
                "dimension": len(values),
                "preview": [round(v, 6) for v in values[:8]],
            }
        )

    return {
        "model": model,
        "snippets": snippets,
        "vectors": vectors,
        "usage_metadata": {
            "prompt_token_count": sum(len(s.split()) for s in snippets),
            "candidates_token_count": 0,
            "total_token_count": sum(len(s.split()) for s in snippets),
        },
    }


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
