"""Per-run telemetry. Adapted from the per-turn pattern used in the
agent cookbook — sized down for one-shot samples while keeping the
rich shape so streaming, chat, and live samples can land later without
schema churn.

What we capture per run:

  Latency
    ttft_ms                 receive → first model token (streaming only)
    total_ms                receive → response complete
    tokens_per_second       output rate; falls back to the full window
                            when streaming is not in play

  Tokens (from response.usage_metadata)
    input_tokens            prompt_token_count
    cached_tokens           cached_content_token_count — implicit + explicit
    output_tokens           candidates_token_count
    thinking_tokens         thoughts_token_count — Gemini 2.5 / 3.x reasoning
    tool_use_prompt_tokens  tool_use_prompt_token_count
    cache_hit_ratio         cached / input

  Modalities
    Per-modality breakdowns surfaced by the unified SDK as
    ModalityTokenCount lists on usage_metadata.
      modalities.input    — prompt_tokens_details
      modalities.output   — candidates_tokens_details
      modalities.cached   — cache_tokens_details

  Cost (USD + INR estimate)
    Per-model rate card. Rates split by modality (audio is 2-3.3× text
    on the Flash family) and by long-context tier where Pro models
    double input above 200K. Cached input billed at the model's
    explicit cached rate (≈10× cheaper than input on Flash, ~10×
    cheaper on Pro — *not* a flat 25% as earlier revisions assumed).
    Refresh _PRICES against ai.google.dev/pricing quarterly. Estimates
    only — never a billing statement.
"""

from __future__ import annotations

import statistics
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, Deque

# ─── Rate card ──────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Rate:
    """Per-model pricing in USD per 1M tokens.

    Fields are deliberately explicit so the reader can read the row and
    verify against ai.google.dev/pricing in a glance. The cost
    computation uses these directly — no implicit discounts, no
    "approximately" — every number on the row is a literal.
    """

    input_per_mtok: float                                 # text input (also covers image/video on most models)
    output_per_mtok: float
    cached_input_per_mtok: float | None = None            # explicit + implicit cache hits
    audio_input_per_mtok: float | None = None             # when audio is priced separately
    cached_audio_per_mtok: float | None = None
    image_input_per_mtok: float | None = None             # when image input is priced separately (embedding models)
    video_input_per_mtok: float | None = None             # when video input is priced separately (embedding models)
    long_context_threshold_tokens: int | None = None      # input above this triggers elevated tier
    long_context_input_per_mtok: float | None = None      # tier-2 input rate
    long_context_output_per_mtok: float | None = None     # tier-2 output rate
    long_context_cached_per_mtok: float | None = None     # tier-2 cached input rate
    storage_per_mtok_per_hour: float | None = None        # cache storage fee
    notes: str | None = None


# Rate card snapshot — May 2026, sourced from
# https://ai.google.dev/pricing (page last updated 2026-04-30 UTC).
# Refresh quarterly.
_PRICES: dict[str, Rate] = {
    # ─── Token-billed text + multimodal ────────────────────────────────────
    "gemini-3.1-pro-preview": Rate(
        input_per_mtok=2.00,
        output_per_mtok=12.00,
        cached_input_per_mtok=0.20,
        long_context_threshold_tokens=200_000,
        long_context_input_per_mtok=4.00,
        long_context_output_per_mtok=18.00,
        long_context_cached_per_mtok=0.40,
        storage_per_mtok_per_hour=4.50,
    ),
    "gemini-3-pro-preview": Rate(
        input_per_mtok=2.00,
        output_per_mtok=12.00,
        cached_input_per_mtok=0.20,
        long_context_threshold_tokens=200_000,
        long_context_input_per_mtok=4.00,
        long_context_output_per_mtok=18.00,
        long_context_cached_per_mtok=0.40,
        storage_per_mtok_per_hour=4.50,
    ),
    "gemini-3-flash-preview": Rate(
        input_per_mtok=0.50,
        output_per_mtok=3.00,
        cached_input_per_mtok=0.05,
        audio_input_per_mtok=1.00,
        cached_audio_per_mtok=0.10,
        storage_per_mtok_per_hour=1.00,
    ),
    "gemini-3.1-flash-lite-preview": Rate(
        input_per_mtok=0.25,
        output_per_mtok=1.50,
        cached_input_per_mtok=0.025,
        audio_input_per_mtok=0.50,
        cached_audio_per_mtok=0.05,
        storage_per_mtok_per_hour=1.00,
    ),
    # Live API
    "gemini-3.1-flash-live-preview": Rate(
        input_per_mtok=0.75,
        output_per_mtok=4.50,
        audio_input_per_mtok=3.00,
        notes="Live API — also priced per-minute: $0.005/min audio in, $0.018/min audio out.",
    ),
    "gemini-2.5-flash-native-audio-preview-12-2025": Rate(
        input_per_mtok=0.50,
        output_per_mtok=2.00,
        audio_input_per_mtok=3.00,
        notes="Live API — output audio billed at $12/MTok.",
    ),
    # TTS
    "gemini-3.1-flash-tts-preview": Rate(input_per_mtok=1.00, output_per_mtok=20.00),
    "gemini-2.5-pro-preview-tts": Rate(input_per_mtok=1.00, output_per_mtok=20.00),
    "gemini-2.5-flash-preview-tts": Rate(input_per_mtok=0.50, output_per_mtok=10.00),
    # Gemini 2.5 family
    "gemini-2.5-pro": Rate(
        input_per_mtok=1.25,
        output_per_mtok=10.00,
        cached_input_per_mtok=0.125,
        long_context_threshold_tokens=200_000,
        long_context_input_per_mtok=2.50,
        long_context_output_per_mtok=15.00,
        long_context_cached_per_mtok=0.25,
        storage_per_mtok_per_hour=4.50,
    ),
    "gemini-2.5-flash": Rate(
        input_per_mtok=0.30,
        output_per_mtok=2.50,
        cached_input_per_mtok=0.03,
        audio_input_per_mtok=1.00,
        cached_audio_per_mtok=0.10,
        storage_per_mtok_per_hour=1.00,
    ),
    "gemini-2.5-flash-lite": Rate(
        input_per_mtok=0.10,
        output_per_mtok=0.40,
        cached_input_per_mtok=0.01,
        audio_input_per_mtok=0.30,
        cached_audio_per_mtok=0.03,
        storage_per_mtok_per_hour=1.00,
    ),
    # Specialized
    "gemini-2.5-computer-use-preview-10-2025": Rate(
        input_per_mtok=1.25,
        output_per_mtok=10.00,
        long_context_threshold_tokens=200_000,
        long_context_input_per_mtok=2.50,
        long_context_output_per_mtok=15.00,
    ),
    "gemini-robotics-er-1.6-preview": Rate(
        input_per_mtok=1.00,
        output_per_mtok=5.00,
        audio_input_per_mtok=2.00,
    ),
    # Embeddings — output rate is zero in the per-MTok sense; the embedding
    # response carries a vector, not output tokens.
    "gemini-embedding-2": Rate(
        input_per_mtok=0.20,                              # text
        output_per_mtok=0.0,
        audio_input_per_mtok=6.50,                        # ≈ $0.00016 / sec
        image_input_per_mtok=0.45,                        # ≈ $0.00012 / image
        video_input_per_mtok=12.00,                       # ≈ $0.00079 / frame
    ),
    "gemini-embedding-001": Rate(
        input_per_mtok=0.15,
        output_per_mtok=0.0,
        notes="Batch input: $0.075/MTok.",
    ),
    # ─── Asset-billed image and video ──────────────────────────────────────
    # For Nano Banana the text-prompt input is token-billed at the rate below;
    # the per-image fee is surfaced via _ASSET_NOTES. Veo and Imagen are
    # *purely* per-asset: ai.google.dev/pricing publishes no per-token input
    # rate for either, so we set both rates to zero and rely on the asset
    # schedule in the calculator (see frontend VEO_PER_SECOND_USD).
    "gemini-3-pro-image-preview": Rate(input_per_mtok=2.00, output_per_mtok=0.0),
    "gemini-3.1-flash-image-preview": Rate(input_per_mtok=0.50, output_per_mtok=0.0),
    "gemini-2.5-flash-image": Rate(input_per_mtok=0.30, output_per_mtok=0.0),
    "imagen-4": Rate(input_per_mtok=0.0, output_per_mtok=0.0),
    # Veo — every variant is per-second-of-output billed; per-token rates are 0.
    "veo-3.1-generate-preview": Rate(input_per_mtok=0.0, output_per_mtok=0.0),
    "veo-3.1-fast-generate-preview": Rate(input_per_mtok=0.0, output_per_mtok=0.0),
    "veo-3.1-lite-generate-preview": Rate(input_per_mtok=0.0, output_per_mtok=0.0),
    "veo-3.0-generate-001": Rate(input_per_mtok=0.0, output_per_mtok=0.0),
    "veo-3.0-fast-generate-001": Rate(input_per_mtok=0.0, output_per_mtok=0.0),
    "veo-2.0-generate-001": Rate(input_per_mtok=0.0, output_per_mtok=0.0),
}

# Per-asset fees that the per-MTok rate card cannot express. Sourced from
# ai.google.dev/pricing (snapshot 2026-04-30).
_ASSET_NOTES: dict[str, str] = {
    "gemini-3-pro-image-preview": "+ $0.134 per image (1K-2K), $0.24 (4K)",
    "gemini-3.1-flash-image-preview": "+ $0.045-$0.151 per image (0.5K-4K)",
    "gemini-2.5-flash-image": "+ $0.039 per image (1K)",
    "imagen-4": "+ $0.02 (Fast) / $0.04 (Standard) / $0.06 (Ultra) per image",
    "veo-3.1-generate-preview": "+ $0.40 (720p/1080p) / $0.60 (4K) per second of video",
    "veo-3.1-fast-generate-preview": "+ $0.10 (720p) / $0.12 (1080p) / $0.30 (4K) per second of video",
    "veo-3.1-lite-generate-preview": "+ $0.05 (720p) / $0.08 (1080p) per second of video",
    "veo-3.0-generate-001": "+ $0.40 per second of video",
    "veo-3.0-fast-generate-001": "+ $0.10 (720p) / $0.12 (1080p) / $0.30 (4K) per second of video",
    "veo-2.0-generate-001": "+ $0.35 per second of video",
}

_USD_TO_INR = 84.0


def _price_of(model: str) -> Rate | None:
    """Longest-prefix match — `gemini-3-flash-preview-09-2026` resolves to
    the `gemini-3-flash-preview` row when the dated variant is missing."""
    best = ""
    for prefix in _PRICES:
        if model.startswith(prefix) and len(prefix) > len(best):
            best = prefix
    return _PRICES.get(best)


def _compute_cost_usd(
    *,
    rate: Rate,
    text_input: int,
    audio_input: int,
    cached_text: int,
    cached_audio: int,
    output: int,
    thinking: int,
) -> dict:
    """Honest cost math against a Rate row.

    All arguments in tokens. text_input includes image and video inputs
    (pricing is unified for those); audio_input is broken out because
    several models charge a separate audio rate. Cached input mirrors
    the same split.
    """
    total_billable_input = text_input + audio_input + cached_text + cached_audio
    long_ctx = (
        rate.long_context_threshold_tokens is not None
        and total_billable_input > rate.long_context_threshold_tokens
    )

    text_rate = (
        rate.long_context_input_per_mtok
        if long_ctx and rate.long_context_input_per_mtok is not None
        else rate.input_per_mtok
    )
    audio_rate = rate.audio_input_per_mtok if rate.audio_input_per_mtok is not None else text_rate
    out_rate = (
        rate.long_context_output_per_mtok
        if long_ctx and rate.long_context_output_per_mtok is not None
        else rate.output_per_mtok
    )
    cached_text_rate = (
        rate.long_context_cached_per_mtok
        if long_ctx and rate.long_context_cached_per_mtok is not None
        else (rate.cached_input_per_mtok if rate.cached_input_per_mtok is not None else 0.0)
    )
    cached_audio_rate = (
        rate.cached_audio_per_mtok
        if rate.cached_audio_per_mtok is not None
        else cached_text_rate
    )

    parts = {
        "text_input_usd": text_input * text_rate / 1_000_000,
        "audio_input_usd": audio_input * audio_rate / 1_000_000,
        "cached_text_usd": cached_text * cached_text_rate / 1_000_000,
        "cached_audio_usd": cached_audio * cached_audio_rate / 1_000_000,
        "output_usd": output * out_rate / 1_000_000,
        "thinking_usd": thinking * out_rate / 1_000_000,
    }
    total = sum(parts.values())
    return {
        "total_usd": total,
        "tier": "long-context" if long_ctx else "standard",
        "parts": parts,
        "rates_used": {
            "text_input_per_mtok": text_rate,
            "audio_input_per_mtok": audio_rate,
            "output_per_mtok": out_rate,
            "cached_text_per_mtok": cached_text_rate,
            "cached_audio_per_mtok": cached_audio_rate,
        },
    }


def _merge_modalities(target: dict[str, int], details: Any) -> None:
    if not details:
        return
    try:
        for entry in details:
            modality = entry.get("modality") if isinstance(entry, dict) else getattr(entry, "modality", None)
            count = entry.get("token_count") if isinstance(entry, dict) else getattr(entry, "token_count", None)
            if modality is None or count is None:
                continue
            name = getattr(modality, "name", str(modality))
            target[name] = target.get(name, 0) + int(count)
    except TypeError:
        return


def _audio_split(modalities: dict[str, int], total: int) -> tuple[int, int]:
    """Return (non_audio, audio) tokens given a modalities dict and a total.

    Falls back to (total, 0) when no AUDIO bucket is present — the common
    case for text-only workloads. The unified SDK's ModalityTokenCount
    enum surfaces "AUDIO" as a stable string."""
    audio = int(modalities.get("AUDIO", 0) or 0)
    non_audio = max(total - audio, 0)
    return non_audio, audio


# ─── Per-run telemetry ──────────────────────────────────────────────────────


class TurnMetrics:
    """One run's worth of telemetry. Mirrors the ADK cookbook shape so
    multi-event scenarios (streaming, chat, live) can reuse the same
    container without schema drift."""

    __slots__ = (
        "model", "started_at", "first_token_at", "finished_at",
        "input_tokens", "cached_tokens", "output_tokens", "thinking_tokens",
        "tool_use_prompt_tokens",
        "modalities_in", "modalities_out", "modalities_cached",
        "tool_calls", "model_calls", "partial_events", "interrupted",
        "finish_reason", "error",
    )

    def __init__(self, model: str):
        self.model = model
        self.started_at: float = time.monotonic()
        self.first_token_at: float | None = None
        self.finished_at: float | None = None
        self.input_tokens: int = 0
        self.cached_tokens: int = 0
        self.output_tokens: int = 0
        self.thinking_tokens: int = 0
        self.tool_use_prompt_tokens: int = 0
        self.modalities_in: dict[str, int] = {}
        self.modalities_out: dict[str, int] = {}
        self.modalities_cached: dict[str, int] = {}
        self.tool_calls: int = 0
        self.model_calls: int = 0
        self.partial_events: int = 0
        self.interrupted: bool = False
        self.finish_reason: str | None = None
        self.error: str | None = None

    def mark_first_token(self) -> None:
        if self.first_token_at is None:
            self.first_token_at = time.monotonic()

    def record_usage(self, usage: Any) -> None:
        """Accept either an SDK usage_metadata object or its model_dump() dict."""
        if usage is None:
            return

        def pick(*names: str) -> int:
            for n in names:
                v = usage.get(n) if isinstance(usage, dict) else getattr(usage, n, None)
                if v is not None:
                    return int(v)
            return 0

        self.input_tokens += pick("prompt_token_count", "prompt_tokens")
        self.cached_tokens += pick("cached_content_token_count", "cached_tokens")
        self.output_tokens += pick("candidates_token_count", "candidate_tokens", "completion_tokens")
        self.thinking_tokens += pick("thoughts_token_count", "thinking_token_count", "reasoning_token_count")
        self.tool_use_prompt_tokens += pick("tool_use_prompt_token_count", "tool_use_prompt_tokens")
        self.model_calls += 1

        details_in = (
            usage.get("prompt_tokens_details") if isinstance(usage, dict)
            else getattr(usage, "prompt_tokens_details", None)
        )
        details_out = (
            usage.get("candidates_tokens_details") if isinstance(usage, dict)
            else getattr(usage, "candidates_tokens_details", None)
        )
        details_cached = (
            usage.get("cache_tokens_details") if isinstance(usage, dict)
            else getattr(usage, "cache_tokens_details", None)
        )
        _merge_modalities(self.modalities_in, details_in)
        _merge_modalities(self.modalities_out, details_out)
        _merge_modalities(self.modalities_cached, details_cached)

    def record_tool_call(self) -> None:
        self.tool_calls += 1

    def finish(self, error: str | None = None) -> None:
        self.finished_at = time.monotonic()
        self.error = error

    def as_dict(self) -> dict:
        end = self.finished_at if self.finished_at is not None else time.monotonic()

        def ms(a: float | None, b: float | None) -> float | None:
            if a is None or b is None:
                return None
            return round((b - a) * 1000, 1)

        rate = _price_of(self.model)
        cost_breakdown: dict | None = None
        cost_usd = 0.0
        if rate is not None:
            # Net (non-cached) prompt = input - cached. Split each side by audio modality.
            net_prompt_tokens = max(0, self.input_tokens - self.cached_tokens)
            net_text, net_audio = _audio_split(self.modalities_in, net_prompt_tokens)
            cached_text, cached_audio = _audio_split(self.modalities_cached, self.cached_tokens)
            cost_breakdown = _compute_cost_usd(
                rate=rate,
                text_input=net_text,
                audio_input=net_audio,
                cached_text=cached_text,
                cached_audio=cached_audio,
                output=self.output_tokens,
                thinking=self.thinking_tokens,
            )
            cost_usd = cost_breakdown["total_usd"]

        # Tokens-per-second: prefer the streaming window if it's wide enough,
        # otherwise fall back to the full turn (one-shot calls deliver text and
        # usage in the same instant — the streaming window collapses to zero).
        tps: float | None = None
        if self.output_tokens > 0:
            window: float | None = None
            if self.first_token_at is not None:
                streamed = end - self.first_token_at
                if streamed > 0.05:
                    window = streamed
            if window is None:
                total = end - self.started_at
                if total > 0.05:
                    window = total
            if window:
                tps = round(self.output_tokens / window, 1)

        cache_ratio = (
            round(self.cached_tokens / self.input_tokens, 3)
            if self.input_tokens else 0.0
        )

        return {
            "model": self.model,
            "ttft_ms": ms(self.started_at, self.first_token_at),
            "total_ms": ms(self.started_at, end),
            "in_flight": self.finished_at is None,
            "tokens_per_second": tps,
            "input_tokens": self.input_tokens,
            "cached_tokens": self.cached_tokens,
            "output_tokens": self.output_tokens,
            "thinking_tokens": self.thinking_tokens,
            "tool_use_prompt_tokens": self.tool_use_prompt_tokens,
            "total_tokens": self.input_tokens + self.output_tokens + self.thinking_tokens,
            "cache_hit_ratio": cache_ratio,
            "modalities": {
                "input": dict(self.modalities_in),
                "output": dict(self.modalities_out),
                "cached": dict(self.modalities_cached),
            },
            "tool_calls": self.tool_calls,
            "model_calls": self.model_calls,
            "partial_events": self.partial_events,
            "interrupted": self.interrupted,
            "finish_reason": self.finish_reason,
            "cost_usd": round(cost_usd, 6),
            "cost_inr": round(cost_usd * _USD_TO_INR, 4),
            "cost_tier": cost_breakdown["tier"] if cost_breakdown else None,
            "cost_parts": (
                {k: round(v, 6) for k, v in cost_breakdown["parts"].items()}
                if cost_breakdown else None
            ),
            "error": self.error,
        }


class MetricsStore:
    """Ring-buffer of recent runs + aggregate p50/p95 summary."""

    def __init__(self, window: int = 50) -> None:
        self.runs: Deque[dict] = deque(maxlen=window)

    def record(self, snapshot: dict) -> None:
        self.runs.append(snapshot)

    def reset(self) -> None:
        self.runs.clear()

    def summary(self) -> dict:
        runs = list(self.runs)
        if not runs:
            return {"count": 0}

        def vals(key: str) -> list[float]:
            return [r[key] for r in runs if r.get(key) is not None]

        def p(values: list[float], q: float) -> float | None:
            if not values:
                return None
            ordered = sorted(values)
            k = max(0, min(len(ordered) - 1, int(round((len(ordered) - 1) * q))))
            return round(ordered[k], 1)

        ttft = vals("ttft_ms")
        total = vals("total_ms")
        tps = vals("tokens_per_second")

        total_in = sum(r.get("input_tokens", 0) for r in runs)
        total_cached = sum(r.get("cached_tokens", 0) for r in runs)

        return {
            "count": len(runs),
            "ttft_p50_ms": round(statistics.median(ttft), 1) if ttft else None,
            "ttft_p95_ms": p(ttft, 0.95),
            "latency_p50_ms": round(statistics.median(total), 1) if total else None,
            "latency_p95_ms": p(total, 0.95),
            "tokens_per_second_p50": round(statistics.median(tps), 1) if tps else None,
            "total_input_tokens": total_in,
            "total_cached_tokens": total_cached,
            "total_output_tokens": sum(r.get("output_tokens", 0) for r in runs),
            "total_thinking_tokens": sum(r.get("thinking_tokens", 0) for r in runs),
            "total_tokens": sum(r.get("total_tokens", 0) for r in runs),
            "cache_hit_ratio": round(total_cached / total_in, 3) if total_in else 0.0,
            "total_tool_calls": sum(r.get("tool_calls", 0) for r in runs),
            "total_model_calls": sum(r.get("model_calls", 0) for r in runs),
            "total_cost_usd": round(sum(r.get("cost_usd") or 0 for r in runs), 6),
            "total_cost_inr": round(sum(r.get("cost_inr") or 0 for r in runs), 4),
            "error_count": sum(1 for r in runs if r.get("error")),
        }

    def snapshot(self) -> dict:
        return {"summary": self.summary(), "runs": list(self.runs)}
