# Backend

FastAPI service that hosts the sample registry, executes samples against the
active auth surface, and reports token-usage telemetry.

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
uvicorn app.main:app --reload --port 8000
```

## Auth

Detected once at startup, never persisted. Either or both:

- **AI Studio** — set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`).
- **Vertex AI** — `gcloud auth application-default login` and export
  `GOOGLE_CLOUD_PROJECT` (and optionally `GOOGLE_CLOUD_LOCATION`,
  defaults to `us-central1`).

Probe what the server sees:

```bash
curl localhost:8000/api/auth
```
