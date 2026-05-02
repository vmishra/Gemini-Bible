"""Text embeddings against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
EmbedContentConfig has a smaller knob surface than GenerateContentConfig.
Every documented field is shown explicitly:

  • task_type
    Tells the model what the embedding is for. Six values are documented:
      RETRIEVAL_QUERY        — short search-query embeddings
      RETRIEVAL_DOCUMENT     — long passages being indexed
      SEMANTIC_SIMILARITY    — symmetric similarity (the default here)
      CLASSIFICATION         — bag-of-features for downstream classifier
      CLUSTERING             — symmetric, optimised for k-means / hier
      QUESTION_ANSWERING     — short questions for a QA pipeline
    The model warps the embedding space differently per task; query and
    document embeddings of the same text are *not* interchangeable.
    https://cloud.google.com/vertex-ai/generative-ai/docs/embeddings/get-text-embeddings

  • output_dimensionality=768 (down from native 3072)
    gemini-embedding-2 produces 3072-dim vectors natively; the SDK
    truncates+renormalises to a smaller dim on request. 768 is the sweet
    spot for most retrieval workloads — a 4× index size cut for ~1-2%
    recall drop on standard MTEB sets.

  • title
    Optional short label that the model uses as document context for
    RETRIEVAL_DOCUMENT tasks. Ignored otherwise.

  • auto_truncate
    Default True — long inputs get silently truncated to the model's
    max sequence length. Set False to fail loudly instead.
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
        config=types.EmbedContentConfig(
            # ---- Task ------------------------------------------------------
            # SEMANTIC_SIMILARITY is the symmetric-similarity task (matches
            # the snippets-to-snippets shape of this sample). Switch to
            # RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT if you're building a
            # query/document index.
            task_type="SEMANTIC_SIMILARITY",
            # ---- Output shape ----------------------------------------------
            output_dimensionality=768,    # ↓ from native 3072 — see WHY
            # ---- Document context ------------------------------------------
            title=None,                   # only used for RETRIEVAL_DOCUMENT
            # ---- Input handling --------------------------------------------
            auto_truncate=True,           # default True; False to fail loudly
        ),
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
