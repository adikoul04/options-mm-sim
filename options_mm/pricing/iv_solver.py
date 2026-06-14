"""Implied volatility solving."""

from __future__ import annotations

from dataclasses import dataclass

from scipy.optimize import brentq

from options_mm.pricing.bsm import OptionType, price_bsm


@dataclass(frozen=True)
class IVResult:
    implied_vol: float
    converged: bool
    iterations: int
    method: str


def solve_iv(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: OptionType,
    initial_guess: float = 0.30,
    tolerance: float = 1e-6,
    max_iterations: int = 100,
) -> IVResult:
    """Solve for implied volatility from a market option price."""

    if market_price <= 0:
        raise ValueError("market_price must be positive")

    sigma = initial_guess
    for iteration in range(1, max_iterations + 1):
        result = price_bsm(S, K, T, r, sigma, option_type)
        diff = result.fair_value - market_price
        if abs(diff) < tolerance:
            return IVResult(sigma, True, iteration, "newton")

        if result.vega <= 1e-12:
            break
        sigma = sigma - diff / result.vega
        if sigma <= 0 or sigma > 5:
            break

    def objective(vol: float) -> float:
        return price_bsm(S, K, T, r, vol, option_type).fair_value - market_price

    try:
        implied_vol = brentq(objective, 1e-6, 5.0, xtol=tolerance, maxiter=max_iterations)
        return IVResult(implied_vol, True, max_iterations, "brentq")
    except ValueError:
        return IVResult(max(sigma, 1e-6), False, max_iterations, "failed")

