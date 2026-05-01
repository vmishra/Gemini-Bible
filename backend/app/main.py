"""Gemini Bible backend — sample registry + executor."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import detect

app = FastAPI(title="Gemini Bible", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth")
def auth() -> dict[str, object]:
    state = detect()
    return {
        "ai_studio": {
            "available": state.ai_studio_key_present,
            "source": state.ai_studio_key_source,
        },
        "vertex": {
            "available": state.adc_present and state.vertex_project is not None,
            "adc_source": state.adc_source,
            "project": state.vertex_project,
            "location": state.vertex_location,
        },
        "surfaces": state.available_surfaces,
    }
