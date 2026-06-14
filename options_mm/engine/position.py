"""Position, P&L, and aggregate Greek tracking."""

from __future__ import annotations

from dataclasses import dataclass, field

from options_mm.engine.fill_sim import ContractKey, Trade
from options_mm.pricing.bsm import BSMResult


CONTRACT_MULTIPLIER = 100


@dataclass
class Position:
    quantity: int = 0
    cash: float = 0.0


@dataclass(frozen=True)
class RiskSnapshot:
    pnl: float
    net_delta: float
    net_gamma: float
    net_theta: float
    net_vega: float
    positions: dict[ContractKey, int]


@dataclass
class PositionManager:
    positions: dict[ContractKey, Position] = field(default_factory=dict)

    def record_trade(self, trade: Trade) -> None:
        position = self.positions.setdefault(trade.contract, Position())
        signed_qty = trade.signed_quantity
        position.quantity += signed_qty
        position.cash -= signed_qty * trade.price * CONTRACT_MULTIPLIER

    def mark_to_market(self, marks: dict[ContractKey, float]) -> float:
        pnl = 0.0
        for contract, position in self.positions.items():
            mark = marks.get(contract, 0.0)
            pnl += position.cash + position.quantity * mark * CONTRACT_MULTIPLIER
        return pnl

    def aggregate_greeks(self, greeks: dict[ContractKey, BSMResult]) -> dict[str, float]:
        totals = {"delta": 0.0, "gamma": 0.0, "theta": 0.0, "vega": 0.0}
        for contract, position in self.positions.items():
            result = greeks.get(contract)
            if result is None:
                continue
            multiplier = position.quantity * CONTRACT_MULTIPLIER
            totals["delta"] += result.delta * multiplier
            totals["gamma"] += result.gamma * multiplier
            totals["theta"] += result.theta * multiplier
            totals["vega"] += result.vega * multiplier
        return totals

    def snapshot(
        self,
        marks: dict[ContractKey, float],
        greeks: dict[ContractKey, BSMResult],
    ) -> RiskSnapshot:
        totals = self.aggregate_greeks(greeks)
        return RiskSnapshot(
            pnl=self.mark_to_market(marks),
            net_delta=totals["delta"],
            net_gamma=totals["gamma"],
            net_theta=totals["theta"],
            net_vega=totals["vega"],
            positions={
                contract: position.quantity
                for contract, position in self.positions.items()
                if position.quantity != 0
            },
        )

