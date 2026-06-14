"""Black-Scholes-Merton option pricing and analytic Greeks."""

from __future__ import annotations

from dataclasses import dataclass
from math import exp, log, sqrt
from typing import Literal

from scipy.stats import norm

OptionType = Literal["call", "put"]


@dataclass(frozen=True)
class BSMResult:
    """Theoretical option value and annualized Greeks."""

    fair_value: float
    delta: float
    gamma: float
    theta: float
    vega: float


def price_bsm(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: OptionType,
) -> BSMResult:
    """Return Black-Scholes-Merton fair value and analytic Greeks.

    Args:
        S: Current underlying spot price.
        K: Option strike price.
        T: Time to expiry in years.
        r: Continuously compounded annual risk-free rate.
        sigma: Annualized volatility as a decimal.
        option_type: Either "call" or "put".

    Returns:
        BSMResult with fair value, delta, gamma, annualized theta, and vega.
        Vega is expressed as the value change for a 1.00 volatility change.
    """

    _validate_inputs(S, K, T, sigma, option_type)

    d1, d2 = _d1_d2(S, K, T, r, sigma)
    sqrt_t = sqrt(T)
    discount = exp(-r * T)
    pdf_d1 = norm.pdf(d1)

    if option_type == "call":
        fair_value = S * norm.cdf(d1) - K * discount * norm.cdf(d2)
        delta = norm.cdf(d1)
        theta = (
            -(S * pdf_d1 * sigma) / (2 * sqrt_t)
            - r * K * discount * norm.cdf(d2)
        )
    else:
        fair_value = K * discount * norm.cdf(-d2) - S * norm.cdf(-d1)
        delta = norm.cdf(d1) - 1
        theta = (
            -(S * pdf_d1 * sigma) / (2 * sqrt_t)
            + r * K * discount * norm.cdf(-d2)
        )

    gamma = pdf_d1 / (S * sigma * sqrt_t)
    vega = S * pdf_d1 * sqrt_t

    return BSMResult(
        fair_value=fair_value,
        delta=delta,
        gamma=gamma,
        theta=theta,
        vega=vega,
    )


def _d1_d2(S: float, K: float, T: float, r: float, sigma: float) -> tuple[float, float]:
    d1 = (log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * sqrt(T))
    d2 = d1 - sigma * sqrt(T)
    return d1, d2


def _validate_inputs(
    S: float,
    K: float,
    T: float,
    sigma: float,
    option_type: str,
) -> None:
    if S <= 0:
        raise ValueError("S must be positive")
    if K <= 0:
        raise ValueError("K must be positive")
    if T <= 0:
        raise ValueError("T must be positive")
    if sigma <= 0:
        raise ValueError("sigma must be positive")
    if option_type not in {"call", "put"}:
        raise ValueError('option_type must be "call" or "put"')
