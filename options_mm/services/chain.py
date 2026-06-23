"""Chain pricing and quote monitoring orchestration."""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from options_mm import config
from options_mm.engine.fill_sim import ContractKey, FillSimulator, Trade
from options_mm.engine.position import PositionManager
from options_mm.engine.quote_engine import Quote
from options_mm.pricing.bsm import BSMResult, price_bsm
from options_mm.pricing.iv_solver import solve_iv


def price_chain(
    chain: pd.DataFrame,
    ticker: str,
    spot: float,
    rfr: float,
    as_of: datetime,
    synthetic_market: bool = False,
) -> pd.DataFrame:
    priced = chain.copy()
    expiry_dt = pd.Timestamp(priced["expiry"].iloc[0]).to_pydatetime().replace(tzinfo=timezone.utc)
    T = max((expiry_dt - as_of).total_seconds() / (365 * 24 * 60 * 60), 1 / 365)

    ivs: list[float] = []
    fair_values: list[float] = []
    deltas: list[float] = []
    gammas: list[float] = []
    thetas: list[float] = []
    vegas: list[float] = []
    market_bids: list[float] = []
    market_asks: list[float] = []
    for _, row in priced.iterrows():
        option_type = row["option_type"]
        strike = float(row["strike"])
        raw_bid = float(row.get("bid", 0) or 0)
        raw_ask = float(row.get("ask", 0) or 0)
        mid = float(row.get("mid", 0) or 0)
        if mid <= 0 and raw_bid > 0 and raw_ask > 0:
            mid = (raw_bid + raw_ask) / 2

        chain_iv = float(row.get("impliedVolatility", 0) or 0)
        if chain_iv > 0:
            iv = chain_iv
        elif mid > 0:
            iv_result = solve_iv(mid, spot, strike, T, rfr, option_type)
            iv = iv_result.implied_vol if iv_result else 0.30
        else:
            iv = 0.30

        bsm = price_bsm(spot, strike, T, rfr, iv, option_type)
        if synthetic_market:
            half_spread = (raw_ask - raw_bid) / 2 if raw_ask > raw_bid else config.DEFAULT_SPREAD / 2
            market_bid = max(0.01, bsm.fair_value - half_spread)
            market_ask = max(market_bid + 0.01, bsm.fair_value + half_spread)
        else:
            market_bid = raw_bid
            market_ask = raw_ask

        ivs.append(iv)
        fair_values.append(bsm.fair_value)
        deltas.append(bsm.delta)
        gammas.append(bsm.gamma)
        thetas.append(bsm.theta)
        vegas.append(bsm.vega)
        market_bids.append(market_bid)
        market_asks.append(market_ask)

    priced["iv"] = ivs
    priced["bid"] = market_bids
    priced["ask"] = market_asks
    priced["mid"] = (priced["bid"] + priced["ask"]) / 2
    priced["fair_value"] = fair_values
    priced["delta"] = deltas
    priced["gamma"] = gammas
    priced["theta"] = thetas
    priced["vega"] = vegas
    return priced


def monitor_quotes(
    quotes: dict[ContractKey, Quote],
    priced_chain: pd.DataFrame,
    ticker: str,
    fill_sim: FillSimulator,
    position_manager: PositionManager,
    quantity: int = 1,
) -> list[Trade]:
    fills: list[Trade] = []
    for _, row in priced_chain.iterrows():
        contract = contract_key(ticker, row)
        quote = quotes.get(contract)
        if quote is None:
            continue
        market_bid = float(row.get("bid", 0) or 0)
        market_ask = float(row.get("ask", 0) or 0)
        trade = fill_sim.check_fill(contract, quote, market_bid, market_ask, quantity)
        if trade is not None:
            position_manager.record_trade(trade)
            fills.append(trade)
            quotes.pop(contract, None)
    return fills


def contract_key(ticker: str, row: pd.Series) -> ContractKey:
    return ContractKey(
        ticker=ticker,
        strike=float(row["strike"]),
        expiry=str(row["expiry"]),
        option_type=str(row["option_type"]),
    )


def risk_inputs(
    priced_chain: pd.DataFrame,
    ticker: str,
) -> tuple[dict[ContractKey, float], dict[ContractKey, BSMResult]]:
    marks: dict[ContractKey, float] = {}
    greeks: dict[ContractKey, BSMResult] = {}
    for _, row in priced_chain.iterrows():
        key = contract_key(ticker, row)
        marks[key] = float(row["fair_value"])
        greeks[key] = BSMResult(
            fair_value=float(row["fair_value"]),
            delta=float(row["delta"]),
            gamma=float(row["gamma"]),
            theta=float(row["theta"]),
            vega=float(row["vega"]),
        )
    return marks, greeks
