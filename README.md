# Gemini Bible

A runnable, reference-grade code-sample app for the Gemini API family.
One page. Every API. AI Studio and Vertex AI in parity. Token usage, pricing,
and best-practice links inline next to each sample.

## What it is

Most teams adopting Gemini end up juggling three browser tabs:
the API docs, the pricing page, and a GitHub samples repo. When the
samples don't match the SDK version, or a parameter exists in Vertex
but not in AI Studio, the migration stalls.

Gemini Bible collapses that into one nerdy surface:

- Browse samples by **category** (text, chat, live, image, video, embeddings)
  and **scenario** (basic call, streaming, tool use, structured output,
  context caching, multimodal, system instruction).
- Every sample has an **AI Studio** variant and a **Vertex AI** variant,
  with the diff highlighted.
- Pick a model, hit run, see the response, the latency, and the token
  accounting (input / output / cached / total cost).
- Doc links, pricing row, and best-practice notes sit beside the editor.

## Auth

The backend reads, in this order:

1. `GEMINI_API_KEY` — AI Studio surface
2. `GOOGLE_API_KEY` — alternate AI Studio key
3. Application Default Credentials (`gcloud auth application-default login`) — Vertex surface

Set whichever you need before launching. Keys are read once at startup
and never persisted.

## Project layout

```
backend/    FastAPI server — sample registry, executor, usage metrics
frontend/   Vite + React 19 + TS, Tailwind 4, OKLCH tokens
samples/    The actual code samples — Python primary, TS/Java where shape differs
```

## Status

Early. See `MEMORY.md` in the agent memory directory for the working spec.
