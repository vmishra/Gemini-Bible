"""Auth detection. Read once at startup; never persist."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

Surface = Literal["ai-studio", "vertex"]


@dataclass(frozen=True)
class AuthState:
    ai_studio_key_present: bool
    ai_studio_key_source: str | None  # "GEMINI_API_KEY" | "GOOGLE_API_KEY" | None
    adc_present: bool
    adc_source: str | None  # path to ADC file, or "metadata-server" if running on GCP
    vertex_project: str | None
    vertex_location: str | None

    @property
    def available_surfaces(self) -> list[Surface]:
        out: list[Surface] = []
        if self.ai_studio_key_present:
            out.append("ai-studio")
        if self.adc_present and self.vertex_project:
            out.append("vertex")
        return out


def detect_adc() -> tuple[bool, str | None]:
    explicit = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if explicit and os.path.isfile(explicit):
        return True, explicit
    default_path = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")
    if os.path.isfile(default_path):
        return True, default_path
    if os.environ.get("GCE_METADATA_HOST") or os.environ.get("K_SERVICE"):
        return True, "metadata-server"
    return False, None


def detect() -> AuthState:
    key_source: str | None = None
    if os.environ.get("GEMINI_API_KEY"):
        key_source = "GEMINI_API_KEY"
    elif os.environ.get("GOOGLE_API_KEY"):
        key_source = "GOOGLE_API_KEY"

    adc_present, adc_source = detect_adc()

    return AuthState(
        ai_studio_key_present=key_source is not None,
        ai_studio_key_source=key_source,
        adc_present=adc_present,
        adc_source=adc_source,
        vertex_project=os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GCLOUD_PROJECT"),
        vertex_location=os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1"),
    )
