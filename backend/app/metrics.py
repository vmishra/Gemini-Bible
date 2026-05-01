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

  Cost (estimate, INR + USD)
    Non-cached prompt billed at the model's input rate; cached prompt
    billed at a 25% discount; output and thinking tokens billed at the
    output rate. Refresh _PRICES against ai.google.dev/pricing
    quarterly — these are estimates, not a billing statement.
"""

from __future__ import annotations

import statistics
import time
from collections import deque
from typing import Any, Deque

# USD per million tokens, (input, output). Rate card snapshot — refresh
# against ai.google.dev/pricing and cloud.google.com/vertex-ai/generative-ai/pricing
# at least quarterly.
_PRICES: dict[str, tuple[float, float]] = {
    "gemini-3.1-pro-preview": (1.25, 5.00),
    "gemini-3-pro-preview": (1.25, 5.00),
    "gemini-3-flash-preview": (0.075, 0.30),
    "gemini-3.1-flash-lite-preview": (0.02, 0.08),
    "gemini-3.1-flash-live-preview": (0.30, 2.50),
    "gemini-3.1-flash-tts-preview": (0.30, 2.50),
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.5-flash": (0.075, 0.30),
    "gemini-2.5-flash-lite": (0.02, 0.08),
    "gemini-2.5-flash-native-audio-preview-12-2025": (0.30, 2.50),
    "gemini-2.5-computer-use-preview-10-2025": (1.25, 10.00),
    "gemini-embedding-2": (0.025, 0.0),
    "gemini-embedding-001": (0.025, 0.0),
}
_USD_TO_INR = 84.0
_CACHE_DISCOUNT = 0.25  # cached prompt tokens billed at ~25% of input rate


def _price_of(model: str) -> tuple[float, float]:
    """Longest-prefix match — `gemini-3-flash-preview-09-2026` resolves to
    the `gemini-3-flash-preview` row when the dated variant is missing."""
    best = ""
    for prefix in _PRICES:
        if model.startswith(prefix) and len(prefix) > len(best):
            best = prefix
    return _PRICES.get(best, (0.0, 0.0))


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

        in_price, out_price = _price_of(self.model)
        billable_prompt = max(0, self.input_tokens - self.cached_tokens)
        cost_usd = (
            (billable_prompt / 1_000_000) * in_price
            + (self.cached_tokens / 1_000_000) * in_price * _CACHE_DISCOUNT
            + (self.output_tokens / 1_000_000) * out_price
            + (self.thinking_tokens / 1_000_000) * out_price
        )

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
