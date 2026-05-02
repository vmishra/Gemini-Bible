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


# ---------------------------------------------------------------------------
# text/streaming
# ---------------------------------------------------------------------------

def _streaming_config(captured):
    """Streaming uses generate_content_stream, not generate_content."""
    for path, kwargs in reversed(captured.calls):
        if path == "models.generate_content_stream":
            return kwargs.get("config")
    raise AssertionError("no models.generate_content_stream call was captured")


def test_text_streaming_uses_stream_method(mock_client):
    _, captured = mock_client
    _import("text/streaming/python/ai_studio.py").main()
    paths = [p for p, _ in captured.calls]
    assert "models.generate_content_stream" in paths
    assert "models.generate_content" not in paths


def test_text_streaming_capped_output_tokens(mock_client):
    """The streaming sample bounds max_output_tokens for snappier TTFT."""
    _, captured = mock_client
    _import("text/streaming/python/ai_studio.py").main()
    cfg = _streaming_config(captured)
    assert cfg.max_output_tokens == 2048
    # Other knobs match basic.
    assert cfg.temperature == 1.0
    assert cfg.thinking_config.thinking_level.value == "MEDIUM"


# ---------------------------------------------------------------------------
# text/multimodal-input
# ---------------------------------------------------------------------------

def test_text_multimodal_input_contents_is_list_with_part(mock_client):
    """contents must be a list with the image Part first, text second."""
    _, captured = mock_client
    _import("text/multimodal-input/python/ai_studio.py").main()
    for path, kw in captured.calls:
        if path == "models.generate_content":
            contents = kw.get("contents")
            assert isinstance(contents, list)
            assert len(contents) == 2
            # First element is a Part; second is a string (auto-wrapped).
            from google.genai import types
            assert isinstance(contents[0], types.Part)
            return
    raise AssertionError("no generate_content call captured")


def test_text_multimodal_response_modalities_text_explicit(mock_client):
    _, captured = mock_client
    _import("text/multimodal-input/python/ai_studio.py").main()
    cfg = _generate_content_config(captured)
    # response_modalities is coerced to a list of MediaModality enum values.
    mods = [getattr(m, "value", m) for m in (cfg.response_modalities or [])]
    assert "TEXT" in mods


# ---------------------------------------------------------------------------
# text/structured-output
# ---------------------------------------------------------------------------

def test_text_structured_output_low_temperature_and_schema(mock_client):
    """The signature deviations: temp=0.2 and a JSON schema bound to the model."""
    _, captured = mock_client
    _import("text/structured-output/python/ai_studio.py").main()
    cfg = _generate_content_config(captured)
    assert cfg.temperature == 0.2
    assert cfg.response_mime_type == "application/json"
    assert cfg.response_json_schema is not None
    # Schema came from ChangeReview.model_json_schema(); top-level shape check.
    assert cfg.response_json_schema.get("type") == "object"
    assert "decision" in cfg.response_json_schema.get("properties", {})


# ---------------------------------------------------------------------------
# text/chat
# ---------------------------------------------------------------------------

def test_text_chat_knobs_live_on_chats_create(mock_client):
    """The full GenerateContentConfig must be passed to chats.create — not
    repeated on each send_message."""
    _, captured = mock_client
    _import("text/chat/python/ai_studio.py").main()

    create_calls = [(p, kw) for p, kw in captured.calls if p == "chats.create"]
    send_calls = [(p, kw) for p, kw in captured.calls if p == "chat.send_message"]
    assert len(create_calls) == 1, "chats.create must be invoked exactly once"
    assert len(send_calls) >= 1, "at least one send_message expected"

    cfg = create_calls[0][1].get("config")
    assert cfg is not None
    assert cfg.temperature == 1.0
    assert cfg.thinking_config.thinking_level.value == "MEDIUM"

    # send_message calls should not pass their own config (overrides only when
    # genuinely needed; the default sample doesn't need them).
    for _, kw in send_calls:
        assert "config" not in kw or kw.get("config") is None


# ---------------------------------------------------------------------------
# text/thinking
# ---------------------------------------------------------------------------

def test_text_thinking_showcase_high_level_with_thoughts(mock_client):
    """Showcase sample turns thinking up to 'high' AND includes the trace."""
    _, captured = mock_client
    _import("text/thinking/python/ai_studio.py").main()
    cfg = _generate_content_config(captured)
    assert cfg.thinking_config.thinking_level.value == "HIGH"
    assert cfg.thinking_config.include_thoughts is True


def test_text_thinking_2_5_fallback_budget(mock_client):
    """Caller passes a 2.5 model: showcase budget=2048, thoughts still on."""
    _, captured = mock_client
    _import("text/thinking/python/ai_studio.py").main(model="gemini-2.5-pro")
    cfg = _generate_content_config(captured)
    assert cfg.thinking_config.thinking_budget == 2048
    assert cfg.thinking_config.thinking_level is None
    assert cfg.thinking_config.include_thoughts is True


# ---------------------------------------------------------------------------
# text/tool-call
# ---------------------------------------------------------------------------

def test_text_tool_call_tools_and_mode_auto(mock_client):
    _, captured = mock_client
    mod = _import("text/tool-call/python/ai_studio.py")
    mod.main()
    cfg = _generate_content_config(captured)

    # tools list contains the two Python functions defined in the module.
    assert cfg.tools is not None and len(cfg.tools) == 2
    fn_names = [getattr(t, "__name__", None) for t in cfg.tools]
    assert "get_current_temperature" in fn_names
    assert "get_packing_advice" in fn_names

    # tool_config.function_calling_config.mode == AUTO (default, explicit here).
    assert cfg.tool_config is not None
    assert cfg.tool_config.function_calling_config is not None
    assert cfg.tool_config.function_calling_config.mode.value == "AUTO"


# ---------------------------------------------------------------------------
# text/tool-call-chat
# ---------------------------------------------------------------------------

def test_text_tool_call_chat_tools_on_chats_create(mock_client):
    """Tools and tool_config live on chats.create — persist across send_message."""
    _, captured = mock_client
    _import("text/tool-call-chat/python/ai_studio.py").main()

    create_calls = [(p, kw) for p, kw in captured.calls if p == "chats.create"]
    assert len(create_calls) == 1
    cfg = create_calls[0][1].get("config")
    assert cfg is not None
    assert cfg.tools is not None and len(cfg.tools) == 2
    assert cfg.tool_config.function_calling_config.mode.value == "AUTO"
    assert cfg.system_instruction is not None
    assert "travel assistant" in cfg.system_instruction


# ---------------------------------------------------------------------------
# text/grounding-search
# ---------------------------------------------------------------------------

def test_text_grounding_search_tool_and_block_none(mock_client):
    _, captured = mock_client
    _import("text/grounding-search/python/ai_studio.py").main()
    cfg = _generate_content_config(captured)

    # google_search tool present.
    assert cfg.tools is not None and len(cfg.tools) == 1
    tool = cfg.tools[0]
    assert tool.google_search is not None

    # safety_settings = BLOCK_NONE on all four categories.
    assert cfg.safety_settings is not None and len(cfg.safety_settings) == 4
    for ss in cfg.safety_settings:
        assert ss.threshold.value == "BLOCK_NONE"
    cats = sorted(ss.category.value for ss in cfg.safety_settings)
    assert cats == sorted([
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
    ])
