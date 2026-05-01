# Gemini Bible

A single-page, runnable reference for the Gemini API family. Pick a
model, pick a scenario, read the code, run it against your own key,
read the token bill. AI Studio and Vertex AI in parity.

---

## Why this exists

Every adoption conversation looks the same. A team is moving from
`gemini-2.5-flash` to `gemini-3-flash-preview` and the prompt structure
shifted; or they want a tool-calling sample for Vertex but the doc page
shows the AI Studio shape; or they're costing out long-context against
implicit caching and the pricing page is in a different tab from the
code. Three browser windows, two SDK versions, half-matching examples.

Gemini Bible collapses that loop. One surface. Browse by category and
scenario; the code sample, the parameter reference, the doc link, the
pricing row, and the live token meter sit on the same screen.

It is the reference the author wished existed when working with
customers; it is also the reference customers can fork and take home.

---

## What's in it

**Categories.** Text and chat, Live (realtime audio/video), image
generation (Nano Banana family), video generation (Veo), embeddings.

**Scenarios per category.** Basic call, streaming, multi-turn chat,
function calling, structured output, system instructions, multimodal
input, context caching, thinking budget, safety settings, batch.

**Surfaces.** Every sample exists in two variants — Gemini API
(AI Studio, key-based) and Vertex AI (ADC, project-scoped) — with the
diff highlighted. The unified `google-genai` SDK keeps the bodies close;
the diff is usually the client constructor and a handful of parameter
names.

**Languages.** Python is the canonical surface. TypeScript and Java
appear on scenarios where the SDK shape diverges meaningfully (live
sessions, streaming back-pressure, function-calling typing).

**Telemetry.** Every run reports input tokens, output tokens, cached
tokens, thinking tokens, latency to first token, total latency, and an
estimated cost using the current public rate card.

---

## Quick start

```bash
# 1. Backend (Python 3.11+)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'

# 2. Auth — set whichever surfaces you want active
export GEMINI_API_KEY=...                                  # AI Studio
gcloud auth application-default login                      # Vertex
export GOOGLE_CLOUD_PROJECT=your-project                   # Vertex
export GOOGLE_CLOUD_LOCATION=us-central1                   # Vertex (default)

uvicorn app.main:app --reload --port 8000

# 3. Frontend (Node 20+)
cd ../frontend
pnpm install
pnpm dev    # http://localhost:5173
```

The backend reads keys once at startup. Nothing is persisted to disk,
nothing is sent off-host. The browser talks to localhost only.

---

## Layout

```
backend/
  app/
    main.py        FastAPI entrypoint
    auth.py        Surface detection (AI Studio key, ADC, Vertex project)
    registry.py    Sample manifest loader
    runner.py      Subprocess executor with streaming + usage capture
    pricing.py     Per-model rate card → cost estimation
  pyproject.toml

frontend/
  src/
    styles/tokens.css   OKLCH design tokens
    ui/components/      Button, Chip, Panel, Kbd, Editor
    routes/             Sample browser, sample workspace
    state/              zustand stores

samples/
  text/
    basic/
      python/ai-studio.py
      python/vertex.py
      typescript/ai-studio.ts
      manifest.json
    streaming/
    chat/
    tool-call/
    structured-output/
    context-cache/
  image/
    nano-banana/
  video/
    veo/
  live/
    realtime-audio/
  embeddings/
```

A sample is a directory: one or more code files plus a `manifest.json`
declaring its category, scenario, supported surfaces, target models,
doc URLs, and the run command. The registry scans the tree at startup;
adding a sample is a matter of dropping in a directory.

---

## Design

The interface follows the design system at
`Agentic-Concierge/DESIGN.md` — OKLCH dark-first, Geist + Geist Mono +
Fraunces, spring motion, one champagne accent, Bloomberg-density
telemetry. No spinners, no sparkle icons, no purple gradients.

---

## Sample inventory

| ID                          | Category    | Scenario           | Surfaces             | Languages       |
| --------------------------- | ----------- | ------------------ | -------------------- | --------------- |
| `text.basic`                | text        | basic              | ai-studio · vertex   | python · typescript |
| `text.streaming`            | text        | streaming          | ai-studio · vertex   | python          |
| `text.chat`                 | text        | chat               | ai-studio · vertex   | python          |
| `text.system-instruction`   | text        | system-instruction | ai-studio · vertex   | python          |
| `text.structured-output`    | text        | structured-output  | ai-studio · vertex   | python          |
| `text.thinking`             | text        | thinking           | ai-studio · vertex   | python          |
| `text.tool-call`            | text        | function-calling   | ai-studio · vertex   | python          |
| `text.context-cache`        | text        | context-cache      | ai-studio · vertex   | python          |
| `text.multimodal-input`     | text        | multimodal-input   | ai-studio · vertex   | python          |
| `live.text-roundtrip`       | live        | text-roundtrip     | ai-studio · vertex   | python          |
| `image.nano-banana`         | image       | generation         | ai-studio · vertex   | python          |
| `video.veo`                 | video       | generation         | ai-studio · vertex   | python          |
| `embeddings.basic`          | embeddings  | basic              | ai-studio · vertex   | python          |

Adding a sample is a matter of dropping a directory under `samples/`
with a `manifest.json` and one or more code files. The registry walks
the tree at startup; the UI picks it up on the next refresh.

## Telemetry

Every run emits a snapshot:

- **Latency** — TTFT (time to first token) for streaming and Live
  samples, total wall time for everything else.
- **Tokens** — `prompt`, `cached`, `output`, `thinking`,
  `tool_use_prompt`, total. Per-modality breakdowns (TEXT / AUDIO /
  IMAGE / VIDEO) when the response carries them.
- **Cache hit ratio** — `cached / prompt`. Used to validate explicit
  and implicit cache wins.
- **Cost** — USD and INR estimate. Cached tokens billed at 25% of the
  input rate; thinking tokens at the output rate. Refresh the rate card
  in `backend/app/metrics.py` against ai.google.dev/pricing quarterly.

The last 100 runs sit in a ring buffer; `GET /api/metrics` returns
`{summary, runs}` with p50/p95 across the window.

## Status

v0.1. Thirteen samples spanning text, live, image, video, and
embeddings. Future work tracked in the commit log; SDK shape revisited
on every Gemini family bump.
