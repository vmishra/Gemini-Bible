"""Video generation (Veo) against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment.

Generation is asynchronous — generate_videos returns a long-running
operation. Poll until done, then download the MP4. Runtime: ~30–90s.
"""

import base64
import tempfile
import time
from pathlib import Path

from google import genai


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
