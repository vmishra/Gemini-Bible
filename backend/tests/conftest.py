"""Shared mock infrastructure for sample tests.

The `mock_client` fixture monkeypatches `google.genai.Client` so that any
sample's `main()` runs end-to-end without touching the network. Tests
inspect the captured call list to assert that the right knobs were passed
to the right SDK methods.

Coverage map (every method any sample under `samples/` calls):

    client.models.generate_content        → SDK text response
    client.models.generate_content_stream → iterable of chunks
    client.models.embed_content           → embedding result
    client.models.generate_videos         → LRO operation (initially not done)
    client.operations.get(op)             → LRO operation (returns done=True)
    client.caches.create                  → cache with .name
    client.caches.delete                  → None
    client.chats.create                   → chat object with .send_message
    chat.send_message                     → SDK text response
    client.files.download                 → None (sample writes via .save)
    client.aio.live.connect               → async context manager → live session
    session.send_realtime_input           → None (async)
    session.receive                       → async generator of server responses

Captured call format:

    captured.calls : list[tuple[str, dict]]    # (dotted-path, kwargs)

`time.sleep` is replaced with a no-op so LRO poll loops don't actually sleep.
"""

from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SAMPLES_DIR = REPO_ROOT / "samples"

# Allow `import samples.text.basic.python.ai_studio` style imports during
# tests. The samples tree is not installed as a package; we lean on PEP 420
# namespace-package discovery from the repo root.
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


# ---------------------------------------------------------------------------
# Canned responses
# ---------------------------------------------------------------------------

def _usage_metadata() -> SimpleNamespace:
    """Synthetic usage_metadata covering every field samples destructure."""
    obj = SimpleNamespace(
        prompt_token_count=42,
        candidates_token_count=128,
        total_token_count=170,
        cached_content_token_count=0,
        thoughts_token_count=0,
        prompt_tokens_details=[],
        candidates_tokens_details=[],
        cache_tokens_details=[],
    )
    # Samples call `usage.model_dump(mode="json")`; emulate Pydantic.
    obj.model_dump = lambda mode="json": {
        "prompt_token_count": 42,
        "candidates_token_count": 128,
        "total_token_count": 170,
        "cached_content_token_count": 0,
        "thoughts_token_count": 0,
    }
    return obj


def _text_response() -> SimpleNamespace:
    candidate = SimpleNamespace(finish_reason=SimpleNamespace(name="STOP"))
    return SimpleNamespace(
        text="canned response text",
        candidates=[candidate],
        usage_metadata=_usage_metadata(),
    )


def _stream_chunks():
    return iter([
        SimpleNamespace(
            text="canned ",
            candidates=[SimpleNamespace(finish_reason=None)],
            usage_metadata=None,
        ),
        SimpleNamespace(
            text="stream response",
            candidates=[SimpleNamespace(finish_reason=SimpleNamespace(name="STOP"))],
            usage_metadata=_usage_metadata(),
        ),
    ])


def _embedding_result() -> SimpleNamespace:
    return SimpleNamespace(
        embeddings=[SimpleNamespace(values=[0.1] * 768)],
        usage_metadata=_usage_metadata(),
    )


def _video_operation(done: bool) -> SimpleNamespace:
    if not done:
        return SimpleNamespace(done=False, response=None, name="operations/canned-id")
    video = SimpleNamespace(
        uri="https://example.invalid/video.mp4",
        save=lambda path: Path(path).write_bytes(b"\x00" * 1024),
    )
    return SimpleNamespace(
        done=True,
        name="operations/canned-id",
        response=SimpleNamespace(generated_videos=[SimpleNamespace(video=video)]),
    )


def _cache() -> SimpleNamespace:
    cache_usage = SimpleNamespace(total_token_count=4096)
    cache_usage.model_dump = lambda mode="json": {"total_token_count": 4096}
    return SimpleNamespace(
        name="cachedContents/canned-id",
        usage_metadata=cache_usage,
    )


# ---------------------------------------------------------------------------
# Live API mock — async context manager + async-generator session
# ---------------------------------------------------------------------------

def _live_response_chunk(text: str, complete: bool) -> SimpleNamespace:
    parts = [SimpleNamespace(text=text)]
    model_turn = SimpleNamespace(parts=parts)
    server_content = SimpleNamespace(
        model_turn=model_turn,
        output_transcription=None,
        turn_complete=complete,
    )
    return SimpleNamespace(server_content=server_content)


class _LiveSession:
    def __init__(self, captured):
        self._captured = captured

    async def send_realtime_input(self, **kwargs):
        self._captured.calls.append(("live.session.send_realtime_input", kwargs))

    async def send_client_content(self, **kwargs):
        self._captured.calls.append(("live.session.send_client_content", kwargs))

    async def receive(self):
        # Two chunks: first incomplete (warm-up), then turn-complete.
        yield _live_response_chunk("canned ", complete=False)
        yield _live_response_chunk("live response", complete=True)


class _LiveConnect:
    def __init__(self, captured, **kwargs):
        captured.calls.append(("aio.live.connect", kwargs))
        self._session = _LiveSession(captured)

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, exc_type, exc, tb):
        return None


# ---------------------------------------------------------------------------
# Stub client builder
# ---------------------------------------------------------------------------

def _build_stub_client(captured) -> SimpleNamespace:
    # The Veo LRO progresses to done after one operations.get call. Tracked
    # in a small per-fixture dict so multiple LROs in one test still work.
    op_state: dict[str, Any] = {"polled": False}

    def _record(path: str, args: tuple, kwargs: dict) -> dict:
        # Normalise positional args (caches.delete(name=...), operations.get(op))
        # into a kwargs-shaped dict so tests can assert uniformly.
        if not kwargs and args:
            kwargs = {"_args": args}
        captured.calls.append((path, kwargs))
        return kwargs

    def generate_content(*args, **kwargs):
        _record("models.generate_content", args, kwargs)
        return _text_response()

    def generate_content_stream(*args, **kwargs):
        _record("models.generate_content_stream", args, kwargs)
        return _stream_chunks()

    def embed_content(*args, **kwargs):
        _record("models.embed_content", args, kwargs)
        return _embedding_result()

    def generate_videos(*args, **kwargs):
        _record("models.generate_videos", args, kwargs)
        op_state["polled"] = False
        return _video_operation(done=False)

    def operations_get(*args, **kwargs):
        _record("operations.get", args, kwargs)
        op_state["polled"] = True
        return _video_operation(done=True)

    def caches_create(*args, **kwargs):
        _record("caches.create", args, kwargs)
        return _cache()

    def caches_delete(*args, **kwargs):
        _record("caches.delete", args, kwargs)
        return None

    def files_download(*args, **kwargs):
        _record("files.download", args, kwargs)
        return None

    chat_session = SimpleNamespace(
        send_message=lambda *a, **kw: (
            _record("chat.send_message", a, kw),
            _text_response(),
        )[1],
    )

    def chats_create(*args, **kwargs):
        _record("chats.create", args, kwargs)
        return chat_session

    stub = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=generate_content,
            generate_content_stream=generate_content_stream,
            embed_content=embed_content,
            generate_videos=generate_videos,
        ),
        caches=SimpleNamespace(create=caches_create, delete=caches_delete),
        operations=SimpleNamespace(get=operations_get),
        files=SimpleNamespace(download=files_download),
        chats=SimpleNamespace(create=chats_create),
        aio=SimpleNamespace(
            live=SimpleNamespace(
                connect=lambda **kw: _LiveConnect(captured, **kw),
            ),
        ),
    )
    return stub


# ---------------------------------------------------------------------------
# Public fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_client(monkeypatch):
    """Returns (stub_client, captured). After yielding, every call any sample
    makes through `genai.Client()` lands in `captured.calls`."""
    captured = SimpleNamespace(calls=[])
    stub = _build_stub_client(captured)

    monkeypatch.setattr("google.genai.Client", lambda **_: stub)

    # LRO poll loops sleep — neutralise so smoke tests run instantly.
    monkeypatch.setattr("time.sleep", lambda *a, **k: None)

    return stub, captured
