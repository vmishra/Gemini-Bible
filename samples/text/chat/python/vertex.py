"""Multi-turn chat against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.
"""

import os

from google import genai


def main(model: str = "gemini-3-flash-preview", prompt: str | None = None) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )
    chat = client.chats.create(model=model)

    turns: list[dict] = []
    aggregated = {
        "prompt_token_count": 0,
        "cached_content_token_count": 0,
        "candidates_token_count": 0,
        "thoughts_token_count": 0,
    }

    script = (
        [prompt] if prompt
        else [
            "I'm benchmarking three vector databases on the same workload.",
            "Which one should I weigh hardest on recall vs. p99 latency for a chat-history use case?",
        ]
    )

    last_response = None
    for message in script:
        last_response = chat.send_message(message)
        usage = last_response.usage_metadata
        turn_record = {"user": message, "model": last_response.text, "usage": None}
        if usage:
            dump = usage.model_dump(mode="json")
            turn_record["usage"] = dump
            for k in aggregated:
                aggregated[k] += dump.get(k) or 0
        turns.append(turn_record)

    return {
        "text": last_response.text if last_response else "",
        "model": model,
        "turns": turns,
        "usage_metadata": aggregated,
        "finish_reason": _finish_reason(last_response) if last_response else None,
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
