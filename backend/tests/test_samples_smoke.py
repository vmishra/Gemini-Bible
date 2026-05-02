"""Smoke test — every sample's main() runs end-to-end against the mock client.

Discovers `samples/*/*/python/{ai_studio,vertex}.py` at collection time,
parametrizes over each file, imports the module, calls `main()`, and asserts
the return shape that `runner.py` depends on (so renaming/removing one of
those keys breaks the test before it breaks production).

This is the lightweight regression gate. It catches:
  - import errors (missing SDK symbol, syntax error introduced by sweep)
  - main() raising under default args
  - return-shape regressions (model, usage_metadata keys dropped)

It does NOT verify specific knob values — that's the job of
test_samples_knob_presence.py, which lands per-sample alongside each sweep.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLES_DIR = REPO_ROOT / "samples"


def _discover() -> list[Path]:
    """Every Python sample file under samples/, both surface variants."""
    paths: list[Path] = []
    for f in SAMPLES_DIR.glob("*/*/python/*.py"):
        if f.name in ("ai_studio.py", "vertex.py"):
            paths.append(f)
    return sorted(paths)


def _ident(p: Path) -> str:
    """samples/text/basic/python/ai_studio.py → text/basic/ai_studio."""
    parts = p.relative_to(SAMPLES_DIR).parts
    return f"{parts[0]}/{parts[1]}/{p.stem}"


def _import_sample(path: Path):
    """Import a sample file as a fresh module each time so monkeypatched
    stubs propagate cleanly between tests."""
    name = f"_sample_{path.stem}_{abs(hash(str(path)))}"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None, f"cannot load {path}"
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.parametrize("sample_path", _discover(), ids=_ident)
def test_sample_main_runs(sample_path: Path, mock_client):
    """Imports the sample, calls main() with no args, asserts return shape."""
    mod = _import_sample(sample_path)
    assert hasattr(mod, "main"), f"{_ident(sample_path)} has no main()"

    result = mod.main()

    assert isinstance(result, dict), f"{_ident(sample_path)} main() did not return dict"
    assert "model" in result, f"{_ident(sample_path)} missing 'model' in return"
    assert "usage_metadata" in result, (
        f"{_ident(sample_path)} missing 'usage_metadata' — runner.py reads this"
    )
