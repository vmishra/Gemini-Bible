# Sample Quality Sweep — Design

Status: approved (brainstorming)
Date: 2026-05-03
Owner: Vikas Mishra
Phase: A (of four-phase advanced-features rollout: sample sweep → prompt
tuning → code converter → background refresh agent)

## Goal

Promote every Python sample under `samples/**` from "minimum viable call" to
**reference-grade**. Today the samples are correct but terse: knobs like
`temperature`, `top_p`, `safety_settings`, `seed`, `response_mime_type` are
left implicit, so a reader genuinely cannot tell what the sample is doing
without reading SDK source. After the sweep, every documented knob is shown
with its current value, every non-default choice carries a multi-line
rationale comment with a citation URL, and a top-of-file `WHY THIS SHAPE`
stanza names the family-level patterns at play.

## Non-goals

- TypeScript samples are out of scope. Only `text/basic` has a TS variant
  today; expanding TS coverage is a separate project.
- No new samples and no new model coverage — this is a quality pass on what
  exists, not breadth growth.
- No anchored best-practices catalog (`docs/practices/...`). Citations stay
  as plain Google doc URLs for now; converting URLs to anchor IDs is part
  of Phase B (Prompt Tuning), where the anchored catalog gets introduced.
- No real-API smoke tests. All verification is mock-based to keep the test
  suite free to run.
- No refactoring of the AI Studio / Vertex twin files into shared helpers.
  The pedagogy of the project is "see the actual surface code, side by
  side"; factoring breaks the paste-and-run guarantee.

## Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Which feature first? | Phase A — Sample Quality Sweep |
| 2 | What does "fully optimized" mean? | C — exhaustive (every knob shown with default) AND opinionated (deviate where official guidance says so) |
| 3 | Sweep scope | A — Python only, all samples, both surfaces |
| 4 | Verification strategy | C — mock-only unit tests, no real API calls |
| 5 | Twin-file structure | A — keep verbatim duplication; mock parity test guards against drift |
| 6 | Citation + comment density | A + 3 — official Google doc URLs (defer anchored catalog to Phase B); maximum density (top-of-file `WHY THIS SHAPE` stanza + per-knob multi-line inline comments) |

## The reference-grade template

Every Python sample's `main()` lands in this shape. `text/basic` shown as the
worked example; the same pattern applies family by family.

```python
"""Basic text generation against the Gemini Developer API (AI Studio).

Surface: AI Studio (api-key authenticated).
SDK:     google-genai (unified Python SDK).
Auth:    GEMINI_API_KEY in the environment — picked up by Client() automatically.

WHY THIS SHAPE
==============
This is the reference-grade form: every documented GenerateContentConfig knob
is shown with its default. Where we deviate from default, an inline comment
says why and links to the relevant Google doc. The premise of Gemini Bible is
that a reader should never have to ask "what is this set to?" — defaults are
made visible so the surface area of the API is obvious at a glance.

Family-level patterns at play here:

  • thinking_level="medium"  (Gemini 3.x default is "high")
    The default doubles output cost on simple prompts with no measurable
    quality gain on benchmarks below MMLU-Pro 90. We only spend "high" on
    samples whose entire purpose is to demonstrate deep reasoning (see
    text/thinking). For everything else, "medium" is the responsible
    default.
    https://ai.google.dev/gemini-api/docs/thinking

  • temperature=1.0 (default) preserved
    Plain text generation benefits from the model's native distribution.
    Lower temperatures only help when the output schema is rigid (see
    text/structured-output, where temperature drops to 0.2 for JSON
    consistency).

  • safety_settings=None (defaults ON) preserved
    Gemini's default safety thresholds are the right call for unguided
    text generation. Samples that explicitly need BLOCK_NONE — typically
    grounding samples where the search results themselves are not under
    the model's control — set this knob non-default with rationale (see
    text/grounding-search).
"""

from google import genai
from google.genai import types


def _thinking_config(model: str, level: str) -> types.ThinkingConfig:
    """Routes the thinking knob to the right field per family.

    Gemini 3.x   uses thinking_level: {"minimal", "low", "medium", "high"}.
                 String enum, easy to reason about, default "high".
    Gemini 2.5   uses thinking_budget: int token cap. -1 means dynamic
                 (default), 0 turns thinking off, positive ints cap it.

    Mirrors the helper in every text sample so reading any one of them
    teaches the full thinking-config story.
    """
    if model.startswith("gemini-3"):
        return types.ThinkingConfig(thinking_level=level)
    return types.ThinkingConfig(thinking_budget=-1)


def main(
    model: str = "gemini-3-flash-preview",
    prompt: str | None = None,
    thinking_level: str = "medium",
) -> dict:
    client = genai.Client()

    response = client.models.generate_content(
        model=model,
        contents=prompt or "Explain transformers to a senior backend engineer in three sentences.",
        config=types.GenerateContentConfig(
            # ---- Sampling ---------------------------------------------------
            # The five sampling knobs together control the shape of the next-
            # token distribution. They compose: temperature is applied first
            # (rescales logits), then top_p (nucleus filter), then top_k (hard
            # cap on candidate count). Tightening any one of them reduces
            # variance; tightening multiple compounds.
            temperature=1.0,            # default 1.0; raise above 1 for creative
                                        # writing, drop toward 0 for code/JSON
                                        # determinism. See structured-output
                                        # sample for the JSON case.
            top_p=0.95,                 # default 0.95; nucleus sampling
                                        # threshold. Rarely worth tuning unless
                                        # you've already exhausted temperature.
            top_k=64,                   # default 64 on Gemini 3.x (was 40 on
                                        # 2.5). Hard cap on candidate tokens.
            candidate_count=1,          # default 1; >1 not supported on Gemini
                                        # 3.x. For best-of-N, run main() N times
                                        # with different seeds.
            max_output_tokens=8192,     # default model-dependent; raise for
                                        # long-form, lower to cap spend on
                                        # runaway generations.
            # ---- Stop conditions --------------------------------------------
            # Stop sequences are matched against decoded text, not tokens, so
            # they survive tokenizer differences across model versions.
            stop_sequences=None,        # default None; set to ["\n\n", "###"]
                                        # etc. when you want hard cutoffs.
            # ---- Reasoning --------------------------------------------------
            # See WHY THIS SHAPE for the family-level rationale. The helper
            # routes to thinking_level on Gemini 3.x and thinking_budget on
            # 2.5; both are billed at the *output* token rate.
            thinking_config=_thinking_config(model, thinking_level),
            # ---- Output shape -----------------------------------------------
            # response_mime_type and response_schema together opt the model
            # into structured-output mode. text/plain is the default.
            response_mime_type="text/plain",  # default; "application/json"
                                              # paired with response_schema
                                              # gates the model into JSON mode.
            # ---- Safety -----------------------------------------------------
            # Gemini's default thresholds block clear violations across HARM_
            # CATEGORY_{HARASSMENT,HATE_SPEECH,SEXUALLY_EXPLICIT,DANGEROUS_
            # CONTENT}. Override per-category when you have a concrete reason
            # — see text/grounding-search.
            safety_settings=None,       # default ON
            # ---- Determinism ------------------------------------------------
            # Setting a seed makes the model deterministic for a given
            # (prompt, config, model_version) tuple. Indispensable for
            # evaluation; not useful for end-user generation.
            seed=None,                  # default None; set int for repro runs.
        ),
    )

    usage = response.usage_metadata
    return {
        "text": response.text,
        "model": model,
        "thinking_knob": "thinking_level" if model.startswith("gemini-3") else "thinking_budget",
        "thinking_value": thinking_level if model.startswith("gemini-3") else -1,
        "finish_reason": _finish_reason(response),
        # Full usage_metadata dump — the host runner extracts modality
        # breakdowns, thinking tokens, cache details from this. The runner
        # is permissive about extra keys, but it does require the existing
        # ones (model, usage_metadata, finish_reason) to remain.
        "usage_metadata": usage.model_dump(mode="json") if usage else None,
    }
```

The pattern: **every knob present, grouped by purpose with a section divider,
default-or-deviated value shown with a multi-line comment.** The
`# ---- Section ----` dividers are stable across all samples (Sampling /
Stop / Reasoning / Output shape / Safety / Determinism) so a reader builds a
mental schema after one file.

## Knob inventory per family

The exhaustive list is verified against installed `google-genai` types and
ai.google.dev API ref during implementation. This table fixes the rough
scope.

| Family | Files | Config object | Knobs to expose (groups) | Family-level WHY pattern |
|---|---|---|---|---|
| Text | 12 dirs × 2 surfaces = 24 | `GenerateContentConfig` | sampling (temperature, top_p, top_k, candidate_count, max_output_tokens), stop_sequences, thinking_config, response_mime_type/schema, safety_settings, seed, tools/tool_config, system_instruction, cached_content | thinking_level default & cost; safety defaults; seed for reproducibility |
| Image | image/nano-banana × 2 | `GenerateContentConfig` w/ `response_modalities=['IMAGE']` plus `image_config` | response_modalities, image_config (aspect_ratio, number_of_images), safety_settings, prompt-side conventions | aspect ratio choices, modality routing, billing implication |
| Video | video/veo × 2 | `GenerateVideosConfig` | aspect_ratio, duration_seconds, resolution, fps, person_generation, sample_count, negative_prompt, seed, image (first-frame) | LRO polling cadence; per-second billing implication |
| Music | music/lyria × 2 | Lyria SDK config | weighted prompts, bpm, scale, density, brightness, guidance, seed | weighted prompt syntax; realtime vs batch |
| Speech | speech/tts-{single,multi} × 2 = 4 | `GenerateContentConfig` w/ `response_modalities=['AUDIO']`, `speech_config` | voice_config (prebuilt_voice_config.voice_name, language_code), speech_config (output_audio_encoding) | voice catalog & licensing; codec choice for downstream |
| Embeddings | embeddings/basic × 2 | `EmbedContentConfig` | output_dimensionality, task_type, title, auto_truncate | task_type per use case (RETRIEVAL_QUERY vs RETRIEVAL_DOCUMENT etc.) |
| Live | live/text-roundtrip × 2 | `LiveConnectConfig` | system_instruction, response_modalities, speech_config, voice_config, input/output_audio_transcription, tools, session_resumption, context_window_compression, generation_config | bidi session lifecycle; transcription opt-in cost |

**Total scope: 19 samples × 2 surfaces = 38 Python files.**

Two non-obvious calls made in this table:

- Live samples are the most knob-heavy by far — likely the longest swept
  files (~120 lines each). That's acceptable; the Live API genuinely has
  more surface area, and the WHY stanza is the way we make it
  navigable.
- Veo and Lyria use LRO patterns. The sweep also documents the
  `client.operations.get(op)` polling loop and cadence, not just the
  knobs.
- Image samples: only `nano-banana` (Gemini-native image via
  `generate_content` with `response_modalities=['IMAGE']`) is in scope.
  No Imagen API sample exists today and we're not creating one in this
  sweep.

## Per-sample policy table

For each sample, the knobs that deviate from default and the citation
source. This is the per-file checklist the implementation works through.

| # | Sample | Files | Non-default knobs (rationale) |
|---|---|---|---|
| 1 | text/basic | 2 | `thinking_level="medium"` (default high; halves cost on simple prompts) |
| 2 | text/chat | 2 | basic + persistent `chat = client.chats.create(...)` knobs once at session, not per turn |
| 3 | text/streaming | 2 | `generate_content_stream`, `max_output_tokens=2048` (faster perceived TTFT for long outputs), TTFT measurement comment |
| 4 | text/structured-output | 2 | `temperature=0.2` (JSON consistency), `response_mime_type="application/json"`, `response_schema=PydanticModel` |
| 5 | text/system-instruction | 2 | `system_instruction=...` set once, sampling defaults preserved |
| 6 | text/multimodal-input | 2 | `Part.from_uri` / `Part.from_bytes`, `response_modalities=["TEXT"]` explicit |
| 7 | text/thinking | 2 | `thinking_level="high"` (the showcase), `include_thoughts=True` (Gemini 3.x) |
| 8 | text/tool-call | 2 | `tools=[Tool(function_declarations=[...])]`, `tool_config=ToolConfig(function_calling_config=FunctionCallingConfig(mode="AUTO"))` |
| 9 | text/tool-call-chat | 2 | #8 + multi-turn with persistent tools across `chat.send_message` |
| 10 | text/grounding-search | 2 | `tools=[Tool(google_search=GoogleSearch())]`, `safety_settings={category: "BLOCK_NONE"}` |
| 11 | text/grounding-maps | 2 | `tools=[Tool(google_maps=GoogleMaps(...))]`, lat/lng retrieval mode |
| 12 | text/context-cache | 2 | `client.caches.create(model, contents=..., system_instruction=..., ttl=...)`, then `cached_content=cache.name` |
| 13 | image/nano-banana | 2 | `response_modalities=["IMAGE","TEXT"]`, `image_config=ImageConfig(aspect_ratio="16:9")` |
| 14 | video/veo | 2 | `GenerateVideosConfig(aspect_ratio="16:9", duration_seconds=8, resolution="1080p", person_generation="allow_all", sample_count=1)`, LRO poll loop |
| 15 | music/lyria | 2 | weighted `WeightedPrompt(text=..., weight=...)`, `bpm`, `scale`, `density`, `brightness`, `seed` |
| 16 | speech/tts-single | 2 | `response_modalities=["AUDIO"]`, `speech_config=SpeechConfig(voice_config=VoiceConfig(prebuilt_voice_config=PrebuiltVoiceConfig(voice_name="Kore")), language_code="en-US")` |
| 17 | speech/tts-multi | 2 | #16 + multi-speaker config (named voice per speaker tag) |
| 18 | embeddings/basic | 2 | `task_type="SEMANTIC_SIMILARITY"` (default; show all 6 task types in comment), `output_dimensionality=768` (down from native 3072 with rationale on quality vs cost) |
| 19 | live/text-roundtrip | 2 | `LiveConnectConfig(response_modalities=["TEXT"], system_instruction=..., session_resumption=SessionResumptionConfig(handle=None))`, transcription opt-in flagged in WHY stanza |

For samples that already have partial reference-grade structure
(`text/basic` already has `thinking_config` + WHY stanza), the sweep
extends them — no rewrite from scratch.

## Mock unit-test design

Tests live in `backend/tests/`. Pytest is already a dev dependency.

### Layout

```
backend/tests/
  __init__.py
  conftest.py                     # mock_client fixture, capture-call helper
  test_samples_smoke.py           # every main() runs without raising
  test_samples_knob_presence.py   # per-sample: specific knobs in call kwargs
  test_samples_surface_parity.py  # per-sample: AI Studio + Vertex twin parity
```

### Mock pattern

```python
# conftest.py
@pytest.fixture
def mock_client(monkeypatch):
    """Returns (client, captured) pair. captured.calls is a list of every
    method call made on the client, with full kwargs. Tests assert against
    this list."""
    captured = SimpleNamespace(calls=[])

    class _Stub:
        def __getattr__(self, name):
            def method(**kwargs):
                captured.calls.append((name, kwargs))
                return _canned_response(name)
            return method

    stub_client = _Stub()
    monkeypatch.setattr("google.genai.Client", lambda **_: stub_client)
    return stub_client, captured
```

### Three test taxonomies

1. **Smoke** (`test_samples_smoke.py`) — parametrized over all 38 files.
   Asserts `main()` runs without raising and returns a dict with `model`
   and `usage_metadata` keys.
2. **Knob presence** (`test_samples_knob_presence.py`) — one or more tests
   per sample asserting specific knob values match the per-sample policy
   table. Intentionally brittle: changing the design choice means
   updating the test, which is the point.
3. **Surface parity** (`test_samples_surface_parity.py`) — for each
   sample dir, both surface variants must call the SDK with identical
   generation kwargs. Only client-constructor args differ. A
   `_normalize` helper strips the constructor args and tool-instance
   identities before comparison.

Coverage target: ~38 smoke + ~50 knob + 19 parity ≈ **107 tests**, runs
in <5s because everything is mocked.

## Migration plan

Per the standing "commit small, commit often" preference and the explicit
guidance to **maximize commits**, this lands as a long sequence of tiny
commits — each commit fully passes the test suite, each is reviewable in
isolation. Push after each commit. Author: Vikas Mishra.

### Infra commits (4)

| # | Commit | Files touched |
|---|---|---|
| I0 | `tests: add pytest package layout` | `backend/tests/__init__.py` (empty) |
| I1 | `tests: mock_client fixture + canned response helper` | `backend/tests/conftest.py` |
| I2 | `tests: smoke harness — every sample main() runs under mock` | `backend/tests/test_samples_smoke.py` |
| I3 | `tests: surface-parity harness — AI Studio + Vertex twins agree on call kwargs` | `backend/tests/test_samples_surface_parity.py` |

After I3 the harness runs green against the *current* (unswept) samples.
Subsequent per-sample commits add knob-presence assertions on top.

### Per-sample commits (3 each × 19 samples = 57)

For every sample, three small commits in this order:

1. `samples(<id>): sweep AI Studio twin to reference-grade form`
2. `samples(<id>): sweep Vertex twin to match`
3. `tests(<id>): knob-presence assertions for the swept knobs`

Splitting AI Studio and Vertex into separate commits is intentional even
though they are near-duplicates: a reviewer reading commit (2) sees only
the second-surface diff, which makes any drift between the twins
immediately visible. The parity test from I3 enforces this mechanically.

### Sample order

Same sequencing rationale as before — simplest text samples first so the
pattern stabilizes before the hairy ones (grounding, context-cache,
live).

| Block | Sample |
|---|---|
| 1 | text/basic |
| 2 | text/system-instruction |
| 3 | text/streaming |
| 4 | text/multimodal-input |
| 5 | text/structured-output |
| 6 | text/chat |
| 7 | text/thinking |
| 8 | text/tool-call |
| 9 | text/tool-call-chat |
| 10 | text/grounding-search |
| 11 | text/grounding-maps |
| 12 | text/context-cache |
| 13 | embeddings/basic |
| 14 | image/nano-banana |
| 15 | speech/tts-single |
| 16 | speech/tts-multi |
| 17 | music/lyria |
| 18 | video/veo |
| 19 | live/text-roundtrip |

### Total

**4 infra + 57 per-sample = 61 commits.** Each gets pushed to `origin/main`
as it lands, so progress is visible incrementally and any single commit
can be reverted without disturbing the rest.

### Definition of done per commit

1. Both surface twins for the sample swept to the canonical form above.
2. Top-of-file `WHY THIS SHAPE` stanza naming the non-trivial knob
   choices, with citation URLs.
3. Per-knob inline comment (one-liner, may wrap to two lines for long
   rationales) plus the top-of-file `WHY THIS SHAPE` stanza covering
   family-level patterns. A reader scanning a single file should be able
   to learn the entire knob surface for that family from the
   combination.
4. Knob-presence tests added; all tests green (`pytest backend/tests/`).
5. `ruff check backend/` clean.
6. Sample still consumed correctly by the existing host runner —
   verified by smoke test (`model`, `usage_metadata`, `finish_reason`
   keys present in return dict).

## Risks

- **SDK shape drift.** `google-genai` evolves fast. Knob names are
  verified against the version pinned in `pyproject.toml`
  (`google-genai>=1.0`) at sweep time. If a knob was renamed, the
  sweep uses the current name and the WHY stanza notes the change.
- **`text/grounding-maps`.** This sample's tool surface is genuinely
  new and the `google_maps` tool API is still evolving. If the
  installed SDK does not yet have a stable `Tool(google_maps=...)`
  shape, the sweep falls back to "expose the knob signature with a
  `# pending stable SDK` note" rather than fabricating an API.
- **`live/text-roundtrip`.** Bidi sessions are stateful and harder to
  mock cleanly. The mock client may need a special
  `aio.live.connect()` async-context-manager stub. If the mock infra
  grows materially, a `tests/_live_mock.py` helper gets extracted and
  the spec is amended.
- **Runner consumption.** `runner.py` parses each sample's stdout JSON
  for `usage_metadata`, `model`, `tool_calls`, `__ttft_ms`. The sweep
  must not remove these keys from any sample's return dict. Smoke
  tests assert they exist where they used to.

## What lands at the end

- 38 reference-grade Python sample files, every knob visible, every
  choice cited.
- ~107 mock tests, runs in <5s, becomes the regression gate for the
  rest of the project's evolution.
- Zero behavior change for end users (samples produce the same output
  for the same inputs); only the quality of the displayed code
  improves.
- Foundation for Phase B (Prompt Tuning, Code Converter), which both
  depend on having a canonical reference for what each model's
  optimal call looks like.
