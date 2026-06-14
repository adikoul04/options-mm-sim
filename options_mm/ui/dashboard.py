"""Streamlit dashboard for the options market making simulator."""

from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from options_mm import config
from options_mm.data.fetcher import DataFetcher
from options_mm.engine.fill_sim import ContractKey, FillSimulator
from options_mm.engine.position import PositionManager
from options_mm.engine.quote_engine import QuoteEngine
from options_mm.pricing.bsm import BSMResult, price_bsm
from options_mm.pricing.iv_solver import solve_iv


def run_dashboard() -> None:
    import streamlit as st

    st.set_page_config(page_title="Options MM Simulator", layout="wide")
    st.title("Options Market Making Simulator")

    state = st.session_state
    state.setdefault("fetcher", DataFetcher())
    state.setdefault("fill_sim", FillSimulator())
    state.setdefault("position_manager", PositionManager())
    state.setdefault("quotes", {})

    ticker = st.sidebar.text_input("Ticker", config.DEFAULT_TICKER).upper()
    expiry = st.sidebar.text_input("Expiry", "")
    spread = st.sidebar.number_input("Spread", min_value=0.01, value=config.DEFAULT_SPREAD, step=0.01)
    quantity = st.sidebar.number_input("Quantity", min_value=1, value=1, step=1)

    if not expiry:
        st.info("Enter an expiration date like 2026-07-17 to load an option chain.")
        return

    try:
        spot = state.fetcher.get_spot(ticker)
        rfr = state.fetcher.get_rfr()
        chain = state.fetcher.get_chain(ticker, expiry)
    except Exception as exc:
        st.error(f"Data fetch failed: {exc}")
        return

    priced_chain = _price_chain(chain, ticker, spot, rfr)

    chain_tab, quote_tab, risk_tab = st.tabs(["Chain", "Quotes", "Risk"])

    with chain_tab:
        st.metric("Spot", f"{spot:.2f}")
        columns = [
            "contractSymbol",
            "option_type",
            "strike",
            "bid",
            "ask",
            "mid",
            "iv",
            "fair_value",
            "delta",
            "gamma",
            "theta",
            "vega",
        ]
        st.dataframe(priced_chain[[col for col in columns if col in priced_chain.columns]], use_container_width=True)

    with quote_tab:
        contract_symbols = priced_chain["contractSymbol"].tolist()
        selected_symbol = st.selectbox("Contract", contract_symbols)
        selected = priced_chain.loc[priced_chain["contractSymbol"] == selected_symbol].iloc[0]
        engine = QuoteEngine(base_spread=spread)
        quote = engine.make_quote(float(selected["fair_value"]), float(selected["iv"]))
        st.write({"bid": quote.bid, "ask": quote.ask, "fair_value": quote.fair_value})

        contract = _contract_key(ticker, selected)
        if st.button("Send quote"):
            state.quotes[contract] = quote
            st.success("Quote sent")

        market_bid = float(selected.get("bid", 0) or 0)
        market_ask = float(selected.get("ask", 0) or 0)
        trade = None
        if contract in state.quotes:
            trade = state.fill_sim.check_fill(contract, state.quotes[contract], market_bid, market_ask, int(quantity))
        if trade:
            state.position_manager.record_trade(trade)
            st.success(f"Filled {trade.direction} {trade.quantity} at {trade.price:.2f}")

        st.dataframe(pd.DataFrame([vars(trade) for trade in state.fill_sim.trade_log]), use_container_width=True)

    with risk_tab:
        marks, greeks = _risk_inputs(priced_chain, ticker)
        snapshot = state.position_manager.snapshot(marks, greeks)
        c1, c2, c3, c4, c5 = st.columns(5)
        c1.metric("P&L", f"{snapshot.pnl:,.2f}")
        c2.metric("Delta", f"{snapshot.net_delta:,.2f}")
        c3.metric("Gamma", f"{snapshot.net_gamma:,.2f}")
        c4.metric("Theta", f"{snapshot.net_theta:,.2f}")
        c5.metric("Vega", f"{snapshot.net_vega:,.2f}")

        positions = [
            {
                "ticker": key.ticker,
                "strike": key.strike,
                "expiry": key.expiry,
                "option_type": key.option_type,
                "quantity": qty,
            }
            for key, qty in snapshot.positions.items()
        ]
        positions_df = pd.DataFrame(positions)
        st.dataframe(positions_df, use_container_width=True)
        if not positions_df.empty:
            st.bar_chart(positions_df, x="strike", y="quantity")


def _price_chain(chain: pd.DataFrame, ticker: str, spot: float, rfr: float) -> pd.DataFrame:
    priced = chain.copy()
    now = datetime.now(timezone.utc)
    expiry_dt = pd.Timestamp(priced["expiry"].iloc[0]).to_pydatetime().replace(tzinfo=timezone.utc)
    T = max((expiry_dt - now).total_seconds() / (365 * 24 * 60 * 60), 1 / 365)

    ivs: list[float] = []
    fair_values: list[float] = []
    deltas: list[float] = []
    gammas: list[float] = []
    thetas: list[float] = []
    vegas: list[float] = []
    for _, row in priced.iterrows():
        option_type = row["option_type"]
        strike = float(row["strike"])
        mid = float(row.get("mid", 0) or 0)
        iv_result = solve_iv(mid, spot, strike, T, rfr, option_type) if mid > 0 else None
        iv = iv_result.implied_vol if iv_result else float(row.get("impliedVolatility", 0.30) or 0.30)
        bsm = price_bsm(spot, strike, T, rfr, iv, option_type)
        ivs.append(iv)
        fair_values.append(bsm.fair_value)
        deltas.append(bsm.delta)
        gammas.append(bsm.gamma)
        thetas.append(bsm.theta)
        vegas.append(bsm.vega)

    priced["iv"] = ivs
    priced["fair_value"] = fair_values
    priced["delta"] = deltas
    priced["gamma"] = gammas
    priced["theta"] = thetas
    priced["vega"] = vegas
    return priced


def _contract_key(ticker: str, row: pd.Series) -> ContractKey:
    return ContractKey(
        ticker=ticker,
        strike=float(row["strike"]),
        expiry=str(row["expiry"]),
        option_type=str(row["option_type"]),
    )


def _risk_inputs(
    priced_chain: pd.DataFrame,
    ticker: str,
) -> tuple[dict[ContractKey, float], dict[ContractKey, BSMResult]]:
    marks = {}
    greeks = {}
    for _, row in priced_chain.iterrows():
        key = _contract_key(ticker, row)
        marks[key] = float(row["fair_value"])
        greeks[key] = BSMResult(
            fair_value=float(row["fair_value"]),
            delta=float(row["delta"]),
            gamma=float(row["gamma"]),
            theta=float(row["theta"]),
            vega=float(row["vega"]),
        )
    return marks, greeks
