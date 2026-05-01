"""Per-model rate card → cost estimation.

USD per 1M tokens. Values reflect the public Gemini API rate card and
are clearly best-effort — verify against ai.google.dev/pricing and
cloud.google.com/vertex-ai/generative-ai/pricing before billing
decisions. Rates here are surfaced as "estimated cost" in the UI, not
as a contract.

Schema: { input, output, cached_input, thinking? } per model.
A `tier_threshold` denotes a long-context tier that kicks in above N
input tokens (currently used for 2.5 Pro).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Rate:
    input_per_mtok: float
    output_per_mtok: float
    cached_input_per_mtok: float | None = None
    long_context_input_per_mtok: float | None = None
    long_context_output_per_mtok: float | None = None
    long_context_threshold_tokens: int | None = None


# Source of truth lives at ai.google.dev/pricing — refresh quarterly.
RATES: dict[str, Rate] = {
    # Gemini 3.x family (preview pricing — verify before quoting customers)
    "gemini-3.1-pro-preview": Rate(input_per_mtok=2.00, output_per_mtok=12.00, cached_input_per_mtok=0.50),
    "gemini-3-pro-preview": Rate(input_per_mtok=2.00, output_per_mtok=12.00, cached_input_per_mtok=0.50),
    "gemini-3-flash-preview": Rate(input_per_mtok=0.30, output_per_mtok=2.50, cached_input_per_mtok=0.075),
    "gemini-3.1-flash-lite-preview": Rate(input_per_mtok=0.10, output_per_mtok=0.40, cached_input_per_mtok=0.025),
    # Gemini 2.5 family (GA)
    "gemini-2.5-pro": Rate(
        input_per_mtok=1.25,
        output_per_mtok=10.00,
        cached_input_per_mtok=0.31,
        long_context_input_per_mtok=2.50,
        long_context_output_per_mtok=15.00,
        long_context_threshold_tokens=200_000,
    ),
    "gemini-2.5-flash": Rate(input_per_mtok=0.30, output_per_mtok=2.50, cached_input_per_mtok=0.075),
    "gemini-2.5-flash-lite": Rate(input_per_mtok=0.10, output_per_mtok=0.40, cached_input_per_mtok=0.025),
}


def estimate_cost_usd(
    model: str,
    *,
    prompt_tokens: int = 0,
    output_tokens: int = 0,
    cached_tokens: int = 0,
    thinking_tokens: int = 0,
) -> dict:
    rate = RATES.get(model)
    if rate is None:
        return {"available": False, "model": model}

    long_context = (
        rate.long_context_threshold_tokens is not None
        and prompt_tokens > rate.long_context_threshold_tokens
    )
    in_rate = (
        rate.long_context_input_per_mtok
        if long_context and rate.long_context_input_per_mtok is not None
        else rate.input_per_mtok
    )
    out_rate = (
        rate.long_context_output_per_mtok
        if long_context and rate.long_context_output_per_mtok is not None
        else rate.output_per_mtok
    )

    billable_input = max(prompt_tokens - cached_tokens, 0)
    billable_output = output_tokens + thinking_tokens

    input_cost = billable_input * in_rate / 1_000_000
    output_cost = billable_output * out_rate / 1_000_000
    cached_cost = (
        cached_tokens * (rate.cached_input_per_mtok or 0) / 1_000_000
        if rate.cached_input_per_mtok is not None
        else 0.0
    )

    return {
        "available": True,
        "model": model,
        "tier": "long-context" if long_context else "standard",
        "input_cost_usd": round(input_cost, 6),
        "output_cost_usd": round(output_cost, 6),
        "cached_cost_usd": round(cached_cost, 6),
        "total_cost_usd": round(input_cost + output_cost + cached_cost, 6),
    }
