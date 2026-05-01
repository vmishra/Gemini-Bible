"""Sample executor. Spawns a Python subprocess for isolation, captures the
sample's JSON output (text + usage_metadata + optional ttft), and folds the
result into a TurnMetrics snapshot."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import textwrap
from dataclasses import dataclass
from pathlib import Path

from .metrics import TurnMetrics
from .registry import Sample, Variant

DEFAULT_TIMEOUT_S = 120


@dataclass
class RunRequest:
    surface: str
    language: str
    model: str | None
    prompt: str | None
    code_override: str | None = None
    timeout_s: int = DEFAULT_TIMEOUT_S


@dataclass
class RunResult:
    ok: bool
    stdout: str
    stderr: str
    parsed: dict | None
    exit_code: int
    metrics: dict | None


def _python_launcher(sample_file: Path, model: str | None, prompt: str | None) -> str:
    return textwrap.dedent(
        f"""
        import importlib.util, json, sys
        spec = importlib.util.spec_from_file_location("sample", {str(sample_file)!r})
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        kwargs = {{}}
        if {model!r} is not None:
            kwargs["model"] = {model!r}
        if {prompt!r} is not None:
            kwargs["prompt"] = {prompt!r}
        result = mod.main(**kwargs)
        sys.stdout.write(json.dumps(result, default=str))
        """
    ).strip()


def run(sample: Sample, variant: Variant, req: RunRequest) -> RunResult:
    if variant.language != "python":
        raise NotImplementedError(
            f"Runner currently only executes python samples; got {variant.language}"
        )

    sample_path = sample.root / variant.file
    metrics = TurnMetrics(model=req.model or sample.default_model)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        if req.code_override is not None:
            sample_file = tmp_path / "sample.py"
            sample_file.write_text(req.code_override)
        else:
            sample_file = sample_path

        launcher = tmp_path / "_launch.py"
        launcher.write_text(_python_launcher(sample_file, req.model, req.prompt))

        env = os.environ.copy()
        if variant.surface == "vertex":
            env.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")

        try:
            proc = subprocess.run(
                [sys.executable, str(launcher)],
                capture_output=True,
                text=True,
                timeout=req.timeout_s,
                env=env,
            )
        except subprocess.TimeoutExpired as exc:
            metrics.finish(error=f"timed out after {req.timeout_s}s")
            return RunResult(
                ok=False,
                stdout=exc.stdout or "",
                stderr=(exc.stderr or "") + f"\n[timed out after {req.timeout_s}s]",
                parsed=None,
                exit_code=-1,
                metrics=metrics.as_dict(),
            )

    parsed: dict | None = None
    if proc.returncode == 0 and proc.stdout.strip():
        try:
            parsed = json.loads(proc.stdout)
        except json.JSONDecodeError:
            parsed = None

    if parsed is not None:
        # Streaming samples may report their own first-token timestamp.
        ttft_ms = parsed.get("__ttft_ms")
        if isinstance(ttft_ms, (int, float)):
            metrics.first_token_at = metrics.started_at + ttft_ms / 1000.0
        usage_md = parsed.get("usage_metadata") or parsed.get("usage")
        if usage_md:
            metrics.record_usage(usage_md)
        if "model" in parsed:
            metrics.model = parsed["model"]
        if parsed.get("tool_calls"):
            for _ in range(int(parsed["tool_calls"])):
                metrics.record_tool_call()
        finish_reason = parsed.get("finish_reason")
        if finish_reason:
            metrics.finish_reason = str(finish_reason)

    metrics.finish(error=None if proc.returncode == 0 else proc.stderr.strip()[:500] or None)

    return RunResult(
        ok=proc.returncode == 0,
        stdout=proc.stdout,
        stderr=proc.stderr,
        parsed=parsed,
        exit_code=proc.returncode,
        metrics=metrics.as_dict(),
    )
