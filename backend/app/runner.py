"""Sample executor. Spawns a Python subprocess for isolation; captures stdout JSON,
stderr, latency, and forwards usage metadata for cost estimation.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import textwrap
import time
from dataclasses import dataclass
from pathlib import Path

from .registry import Sample, Variant
from .pricing import estimate_cost_usd

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
    latency_ms: float
    cost: dict | None


def _python_launcher(sample_file: Path, model: str | None, prompt: str | None) -> str:
    return textwrap.dedent(
        f"""
        import importlib.util, json, sys, time
        spec = importlib.util.spec_from_file_location("sample", {str(sample_file)!r})
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        kwargs = {{}}
        if {model!r} is not None:
            kwargs["model"] = {model!r}
        if {prompt!r} is not None:
            kwargs["prompt"] = {prompt!r}
        t0 = time.perf_counter()
        result = mod.main(**kwargs)
        result["__latency_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        sys.stdout.write(json.dumps(result, default=str))
        """
    ).strip()


def run(sample: Sample, variant: Variant, req: RunRequest) -> RunResult:
    if variant.language != "python":
        raise NotImplementedError(
            f"Runner currently only executes python samples; got {variant.language}"
        )

    sample_path = sample.root / variant.file

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

        t0 = time.perf_counter()
        try:
            proc = subprocess.run(
                [sys.executable, str(launcher)],
                capture_output=True,
                text=True,
                timeout=req.timeout_s,
                env=env,
            )
        except subprocess.TimeoutExpired as exc:
            return RunResult(
                ok=False,
                stdout=exc.stdout or "",
                stderr=(exc.stderr or "") + f"\n[timed out after {req.timeout_s}s]",
                parsed=None,
                exit_code=-1,
                latency_ms=(time.perf_counter() - t0) * 1000,
                cost=None,
            )
        latency_ms = (time.perf_counter() - t0) * 1000

    parsed: dict | None = None
    if proc.returncode == 0 and proc.stdout.strip():
        try:
            parsed = json.loads(proc.stdout)
        except json.JSONDecodeError:
            parsed = None

    cost = None
    if parsed and "usage" in parsed:
        usage = parsed["usage"]
        cost = estimate_cost_usd(
            parsed.get("model", req.model or sample.default_model),
            prompt_tokens=usage.get("prompt_tokens") or 0,
            output_tokens=usage.get("output_tokens") or 0,
            cached_tokens=usage.get("cached_tokens") or 0,
            thinking_tokens=usage.get("thinking_tokens") or 0,
        )

    return RunResult(
        ok=proc.returncode == 0,
        stdout=proc.stdout,
        stderr=proc.stderr,
        parsed=parsed,
        exit_code=proc.returncode,
        latency_ms=latency_ms,
        cost=cost,
    )
