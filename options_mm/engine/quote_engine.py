"""Quote generation for passive option market making."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Quote:
    bid: float
    ask: float
    fair_value: float
    spread: float


@dataclass
class QuoteEngine:
    base_spread: float = 0.05
    iv_spread_multiplier: float = 0.0
    min_bid: float = 0.01

    def make_quote(self, fair_value: float, iv: float | None = None) -> Quote:
        if fair_value < 0:
            raise ValueError("fair_value cannot be negative")

        spread = self.base_spread
        if iv is not None:
            spread += max(iv, 0) * self.iv_spread_multiplier

        bid = max(self.min_bid, fair_value - spread / 2)
        ask = max(bid + 0.01, fair_value + spread / 2)
        return Quote(bid=round(bid, 4), ask=round(ask, 4), fair_value=fair_value, spread=spread)

