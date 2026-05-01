"""Text embeddings against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.
"""

from google import genai
from google.genai import types


def main(model: str = "gemini-embedding-2", prompt: str | None = None) -> dict:
    client = genai.Client()

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
        # Embeddings responses do not carry usage_metadata in the same shape;
        # report a synthetic count so the runner's totals stay coherent.
        "usage_metadata": {
            "prompt_token_count": sum(len(s.split()) for s in snippets),
            "candidates_token_count": 0,
            "total_token_count": sum(len(s.split()) for s in snippets),
        },
    }


if __name__ == "__main__":
    import json

    print(json.dumps(main(), indent=2, default=str))
