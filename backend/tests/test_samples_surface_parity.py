"""Surface parity — AI Studio and Vertex twins must call the SDK identically.

For every sample directory that has BOTH `ai_studio.py` and `vertex.py`,
the test:

  1. Imports ai_studio, runs main(), records captured calls.
  2. Clears the capture list.
  3. Imports vertex, runs main(), records captured calls.
  4. Asserts the two call sequences are identical: same count, same
     dotted paths in the same order, same kwargs.

The Client() constructor itself is monkeypatched to return the stub
without recording, so the only difference between the two surfaces
(vertex passes project + location to Client; AI Studio passes nothing)
is invisible to the capture stream — exactly the boundary we want.

This is the lock that catches drift between the surface twins as the
sweep evolves them.
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

import pytest

# Function objects and the SimpleNamespace stubs we hand back from the mock
# carry their memory address in repr(). Each module import creates fresh
# instances, so the addresses differ between AI Studio and Vertex twins
# even when the call sites are identical. Strip the addresses before
# comparing so structural equality survives.
_ADDR = re.compile(r" at 0x[0-9a-f]+")


def _normalise(value: object) -> str:
    """repr() with memory addresses scrubbed — stable across re-imports."""
    return _ADDR.sub(" at 0xADDR", repr(value))

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLES_DIR = REPO_ROOT / "samples"


def _discover_paired_dirs() -> list[Path]:
    """Sample dirs that have both surface variants."""
    out: list[Path] = []
    for d in SAMPLES_DIR.glob("*/*/python"):
        if (d / "ai_studio.py").exists() and (d / "vertex.py").exists():
            out.append(d.parent)
    return sorted(out)


def _ident(d: Path) -> str:
    return f"{d.parent.name}/{d.name}"


def _import(path: Path):
    """Fresh module import — distinct sys.modules name per call so AI Studio
    and Vertex twins do not collide."""
    name = (
        f"_parity_{path.parent.parent.parent.name}_"
        f"{path.parent.parent.name}_{path.stem}_{abs(hash(str(path)))}"
    )
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None, f"cannot load {path}"
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.parametrize("sample_dir", _discover_paired_dirs(), ids=_ident)
def test_surface_parity(sample_dir: Path, mock_client):
    _, captured = mock_client

    ai = _import(sample_dir / "python" / "ai_studio.py")
    ai.main()
    ai_calls = list(captured.calls)
    captured.calls.clear()

    vx = _import(sample_dir / "python" / "vertex.py")
    vx.main()
    vx_calls = list(captured.calls)

    ident = _ident(sample_dir)
    assert len(ai_calls) == len(vx_calls), (
        f"{ident}: AI Studio made {len(ai_calls)} SDK calls, "
        f"Vertex made {len(vx_calls)} — surfaces should agree on call count"
    )

    for i, ((a_path, a_kw), (v_path, v_kw)) in enumerate(zip(ai_calls, vx_calls)):
        assert a_path == v_path, (
            f"{ident} call #{i}: dotted paths differ "
            f"(AI Studio {a_path!r} vs Vertex {v_path!r})"
        )
        a_norm = _normalise(a_kw)
        v_norm = _normalise(v_kw)
        assert a_norm == v_norm, (
            f"{ident} call #{i} ({a_path}): kwargs differ after normalisation\n"
            f"  AI Studio: {a_norm}\n"
            f"  Vertex:    {v_norm}"
        )
