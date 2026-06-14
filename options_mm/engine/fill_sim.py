"""Passive quote fill simulation."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from options_mm.engine.quote_engine import Quote


@dataclass(frozen=True)
class ContractKey:
    ticker: str
    strike: float
    expiry: str
    option_type: str


@dataclass(frozen=True)
class Trade:
    contract: ContractKey
    direction: str
    quantity: int
    price: float
    timestamp: datetime

    @property
    def signed_quantity(self) -> int:
        return self.quantity if self.direction == "buy" else -self.quantity


@dataclass
class FillSimulator:
    trade_log: list[Trade] = field(default_factory=list)

    def check_fill(
        self,
        contract: ContractKey,
        quote: Quote,
        market_bid: float,
        market_ask: float,
        quantity: int = 1,
    ) -> Trade | None:
        if quantity <= 0:
            raise ValueError("quantity must be positive")

        trade: Trade | None = None
        if market_bid >= quote.ask:
            trade = Trade(contract, "sell", quantity, quote.ask, datetime.now(timezone.utc))
        elif market_ask <= quote.bid:
            trade = Trade(contract, "buy", quantity, quote.bid, datetime.now(timezone.utc))

        if trade is not None:
            self.trade_log.append(trade)
        return trade

