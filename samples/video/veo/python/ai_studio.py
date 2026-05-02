"""Video generation (Veo) against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

WHY THIS SHAPE
==============
Veo runs as a long-running operation (LRO). Generation takes 30-90s; you
poll the operation until done, then download the MP4 by URI. Billing is
per-second-of-output, NOT per-token — usage_metadata token counts are
synthesised below for the host runner's accounting.

  • client.models.generate_videos(model, prompt, config=GenerateVideosConfig(...))
    Returns an operation immediately. The operation has a name and a
    .done flag; .response is None until .done is True.
    https://ai.google.dev/gemini-api/docs/video

  • GenerateVideosConfig knobs (set explicitly):
      aspect_ratio        — "16:9" / "9:16" / "1:1". Each ratio maps to
                            a fixed output resolution per model tier.
      duration_seconds    — 4 / 6 / 8 (Veo 3.1 menu). Longer durations
                            scale cost linearly — billing is per-second.
      resolution          — "720p" / "1080p". Higher tiers may also offer
                            "4k" but cost-per-second more than doubles.
      person_generation   — DONT_ALLOW / ALLOW_ADULT / ALLOW_ALL.
      number_of_videos    — 1-4 candidates per request. Each is billed.
      negative_prompt     — text the model is told to avoid.
      enhance_prompt      — True = SDK rewrites the prompt for better
                            results; turn off for deterministic eval runs.
      generate_audio      — True = soundtrack generated alongside frames.
      seed                — int for reproducibility.

  • Poll cadence
    8 seconds is a reasonable default — Veo generation rarely finishes
    faster than 30s, so polling more often just wastes API calls.

  • Output handling
    operation.response.generated_videos[0].video carries a server-side
    URI. Call client.files.download then video.save(path) to materialise
    the MP4 bytes locally.
"""

import base64
import tempfile
import time
from pathlib import Path

from google import genai
from google.genai import types


def main(
    model: str = "veo-3.1-lite-generate-preview",
    prompt: str | None = None,
) -> dict:
    client = genai.Client()
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
            negative_prompt=None,       # text the model is told to avoid
            person_generation="ALLOW_ADULT",  # DONT_ALLOW / ALLOW_ADULT / ALLOW_ALL
            # ---- Generation behaviour ---------------------------------------
            enhance_prompt=True,        # SDK rewrites for better results; off for eval
            generate_audio=True,        # soundtrack alongside frames (Veo 3.1)
            # ---- Determinism ------------------------------------------------
            seed=None,                  # set int for reproducible output
        ),
    )

    while not operation.done:
        time.sleep(8)                   # see WHY: Veo rarely finishes <30s
        operation = client.operations.get(operation)

    generated = operation.response.generated_videos[0]
    out_dir = Path(tempfile.mkdtemp(prefix="gemini-bible-veo-"))
    out_path = out_dir / "out.mp4"
    client.files.download(file=generated.video)
    generated.video.save(str(out_path))
    elapsed_s = round(time.perf_counter() - started, 1)

    video_bytes = out_path.read_bytes()
    # Base64 inline so the UI can render via <video src="data:video/mp4;base64,…">.
    return {
        "text": f"Generated {len(video_bytes):,} bytes of MP4 in {elapsed_s}s.",
        "model": model,
        "video": {
            "mime_type": "video/mp4",
            "bytes": len(video_bytes),
            "data_b64": base64.b64encode(video_bytes).decode("ascii"),
            "path": str(out_path),
        },
        # Veo billing is per-second-of-video, not per-token; keep accounting
        # coherent for the metrics ribbon by reporting zeroes.
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
