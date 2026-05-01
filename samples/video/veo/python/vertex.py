"""Video generation (Veo) against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor.
"""

import base64
import os
import tempfile
import time
from pathlib import Path

from google import genai


def main(
    model: str = "veo-3.1-lite-generate-preview",
    prompt: str | None = None,
) -> dict:
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )
    text_prompt = prompt or (
        "A long, slow tracking shot through a misty bamboo forest at dawn, "
        "soft volumetric light filtering between the stalks, a single deer "
        "stepping into the frame and pausing to look toward the camera."
    )

    started = time.perf_counter()
    operation = client.models.generate_videos(
        model=model,
        prompt=text_prompt,
    )

    while not operation.done:
        time.sleep(8)
        operation = client.operations.get(operation)

    generated = operation.response.generated_videos[0]
    out_dir = Path(tempfile.mkdtemp(prefix="gemini-bible-veo-"))
    out_path = out_dir / "out.mp4"
    client.files.download(file=generated.video)
    generated.video.save(str(out_path))
    elapsed_s = round(time.perf_counter() - started, 1)

    video_bytes = out_path.read_bytes()
    return {
        "text": f"Generated {len(video_bytes):,} bytes of MP4 in {elapsed_s}s.",
        "model": model,
        "video": {
            "mime_type": "video/mp4",
            "bytes": len(video_bytes),
            "data_b64": base64.b64encode(video_bytes).decode("ascii"),
            "path": str(out_path),
        },
        "usage_metadata": {
            "prompt_token_count": len(text_prompt.split()),
            "candidates_token_count": 0,
            "total_token_count": len(text_prompt.split()),
        },
    }


if __name__ == "__main__":
    import json

    out = main()
    out["video"] = {k: (v if k != "data_b64" else f"<{len(v):,} chars>") for k, v in out["video"].items()}
    print(json.dumps(out, indent=2, default=str))
