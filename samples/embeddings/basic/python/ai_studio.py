"""Text embeddings against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

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
    https://ai.google.dev/gemini-api/docs/embeddings#task-types

  • output_dimensionality=768 (down from native 3072)
    gemini-embedding-2 produces 3072-dim vectors natively; the SDK
    truncates+renormalises to a smaller dim on request. 768 is the sweet
    spot for most retrieval workloads — a 4× index size cut for ~1-2%
    recall drop on standard MTEB sets. Drop to 256 for memory-bound
    cases; raise to 1536/3072 only when recall is critical.

  • title
    Optional short label that the model uses as document context for
    RETRIEVAL_DOCUMENT tasks. Ignored otherwise.

  • auto_truncate
    Default True — long inputs get silently truncated to the model's
    max sequence length. Set False to fail loudly instead.
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
