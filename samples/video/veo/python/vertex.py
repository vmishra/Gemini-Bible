"""Video generation (Veo) against Vertex AI.

Surface: Vertex AI (ADC + project-scoped).
SDK:     google-genai (unified Python SDK).
Auth:    `gcloud auth application-default login` plus
         GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION in the environment.

Diff vs AI Studio: only the client constructor. The request body is identical
— enforced by tests/test_samples_surface_parity.py.

WHY THIS SHAPE
==============
Veo runs as a long-running operation (LRO). Generation takes 30-90s; you
poll the operation until done, then download the MP4 by URI. Billing is
per-second-of-output, NOT per-token — usage_metadata token counts are
synthesised below for the host runner's accounting.

  • client.models.generate_videos(model, prompt, config=GenerateVideosConfig(...))
    Returns an operation immediately. The operation has a name and a
    .done flag; .response is None until .done is True.
    https://cloud.google.com/vertex-ai/generative-ai/docs/video/overview

  • GenerateVideosConfig knobs (set explicitly):
      aspect_ratio        — "16:9" / "9:16" / "1:1".
      duration_seconds    — 4 / 6 / 8 (Veo 3.1 menu); cost scales linearly.
      resolution          — "720p" / "1080p"; "4k" on Pro tiers.
      person_generation   — DONT_ALLOW / ALLOW_ADULT / ALLOW_ALL.
      number_of_videos    — 1-4 candidates; each is billed separately.
      negative_prompt     — text the model is told to avoid.
      enhance_prompt      — True = SDK rewrites prompt; off for eval runs.
      generate_audio      — True = soundtrack alongside frames (Veo 3.1).
      seed                — int for reproducibility.

  • Poll cadence
    8 seconds is a reasonable default — Veo rarely finishes <30s.

  • Output handling
    operation.response.generated_videos[0].video carries a server-side
    URI. Call client.files.download then video.save(path).
"""

import base64
import os
import tempfile
import time
from pathlib import Path

from google import genai
from google.genai import types


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
        config=types.GenerateVideosConfig(
            # ---- Frame shape ------------------------------------------------
            aspect_ratio="16:9",        # cinematic; "9:16" for vertical
            resolution="1080p",         # "720p" for the lite tier; "4k" on Pro
            duration_seconds=8,         # 4 / 6 / 8 (Veo 3.1 menu)
            # ---- Generation count -------------------------------------------
            number_of_videos=1,         # 1-4; each candidate is billed
            # ---- Content guidance -------------------------------------------
            negative_prompt=None,
            person_generation="ALLOW_ADULT",
            # ---- Generation behaviour ---------------------------------------
            enhance_prompt=True,
            generate_audio=True,
            # ---- Determinism ------------------------------------------------
            seed=None,
        ),
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
