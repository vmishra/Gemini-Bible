"""Knob-presence tests — per-sample assertions that the swept knobs reach
the SDK with the values the design committed to.

Each test imports a sample's main(), runs it under the mock client, and
inspects the captured call kwargs. Tests are intentionally brittle: if a
sweep changes a knob value, the test must be updated in the same commit.
That is the design — the test is a lock on the chosen value.

One test (or a small group) per sample. Tests grow as the sweep
progresses through the per-sample policy table in the spec.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLES_DIR = REPO_ROOT / "samples"


def _import(rel: str):
    """Helper: import samples/<rel> as a fresh module per call."""
    path = SAMPLES_DIR / rel
    name = f"_knob_{rel.replace('/', '_').replace('.py', '')}_{abs(hash(str(path)))}"
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def _generate_content_config(captured):
    """Pull the GenerateContentConfig from the most recent generate_content
    call. Most knob-presence tests want this object to assert against."""
    for path, kwargs in reversed(captured.calls):
        if path == "models.generate_content":
            return kwargs.get("config")
    raise AssertionError("no models.generate_content call was captured")


# ---------------------------------------------------------------------------
# text/basic
# ---------------------------------------------------------------------------

def test_text_basic_ai_studio_knobs(mock_client):
    _, captured = mock_client
    _import("text/basic/python/ai_studio.py").main()
    cfg = _generate_content_config(captured)

    # Sampling defaults made explicit.
    assert cfg.temperature == 1.0
    assert cfg.top_p == 0.95
    assert cfg.top_k == 64
    assert cfg.candidate_count == 1
    assert cfg.max_output_tokens == 8192

    # Stop / output / safety / determinism defaults.
    assert cfg.stop_sequences is None
    assert cfg.response_mime_type == "text/plain"
    assert cfg.safety_settings is None
    assert cfg.seed is None

    # Reasoning — the lone deviation from default for this sample.
    # Default model is gemini-3-flash-preview, so thinking_level applies.
    assert cfg.thinking_config is not None
    assert cfg.thinking_config.thinking_level.value == "MEDIUM"


def test_text_basic_vertex_knobs(mock_client):
    _, captured = mock_client
    _import("text/basic/python/vertex.py").main()
    cfg = _generate_content_config(captured)

    assert cfg.temperature == 1.0
    assert cfg.top_p == 0.95
    assert cfg.top_k == 64
    assert cfg.candidate_count == 1
    assert cfg.max_output_tokens == 8192
    assert cfg.stop_sequences is None
    assert cfg.response_mime_type == "text/plain"
    assert cfg.safety_settings is None
    assert cfg.seed is None
    # SDK coerces "medium" → ThinkingLevel.MEDIUM ('MEDIUM'); compare on .value.
    assert cfg.thinking_config.thinking_level.value == "MEDIUM"


def test_text_basic_thinking_routes_to_2_5_budget(mock_client):
    """Caller passes a 2.5 model: helper must use thinking_budget, not level."""
    _, captured = mock_client
    _import("text/basic/python/ai_studio.py").main(model="gemini-2.5-flash")
    cfg = _generate_content_config(captured)
    # thinking_level is unset (None) on Gemini 2.5; thinking_budget=-1 (dynamic).
    assert cfg.thinking_config.thinking_budget == -1
    assert cfg.thinking_config.thinking_level is None


# ---------------------------------------------------------------------------
# text/system-instruction
# ---------------------------------------------------------------------------

def test_text_system_instruction_persona_lives_on_config(mock_client):
    """The persona must reach the config object, not the contents string."""
    _, captured = mock_client
    mod = _import("text/system-instruction/python/ai_studio.py")
    mod.main()
    cfg = _generate_content_config(captured)
    assert cfg.system_instruction is not None
    # Match the constant exported from the module so future copy edits to
    # the persona stay in sync without updating the test value.
    assert cfg.system_instruction == mod.SYSTEM_INSTRUCTION


def test_text_system_instruction_inherits_basic_defaults(mock_client):
    """Knob defaults match text/basic — only system_instruction deviates."""
    _, captured = mock_client
    _import("text/system-instruction/python/ai_studio.py").main()
    cfg = _generate_content_config(captured)
    assert cfg.temperature == 1.0
    assert cfg.top_p == 0.95
    assert cfg.top_k == 64
    assert cfg.thinking_config.thinking_level.value == "MEDIUM"
