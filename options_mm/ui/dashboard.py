"""Streamlit dashboard for the options market making simulator."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
import time as time_module
from zoneinfo import ZoneInfo

import pandas as pd

from options_mm import config
from options_mm.data.fetcher import DataFetcher
from options_mm.engine.fill_sim import ContractKey, FillSimulator
from options_mm.engine.position import PositionManager
from options_mm.engine.quote_engine import Quote, QuoteEngine
from options_mm.pricing.bsm import BSMResult, price_bsm
from options_mm.pricing.iv_solver import solve_iv

MARKET_TIMEZONE = "America/New_York"
LOCAL_TIMEZONE = "America/Chicago"


def run_dashboard() -> None:
    import streamlit as st

    st.set_page_config(page_title="Options MM Simulator", layout="wide")
    st.title("Options Market Making Simulator")

    state = st.session_state
    state.setdefault("fetcher", DataFetcher())
    state.setdefault("fill_sim", FillSimulator())
    state.setdefault("position_manager", PositionManager())
    state.setdefault("quotes", {})
    state.setdefault("clock_running", False)
    state.setdefault("replay_current_time", None)
    state.setdefault("replay_last_wall_time", None)

    ticker = st.sidebar.text_input("Ticker", config.DEFAULT_TICKER).upper()
    expiry = st.sidebar.text_input("Expiry", "")
    spread = st.sidebar.number_input("Spread", min_value=0.01, value=config.DEFAULT_SPREAD, step=0.01)
    quantity = st.sidebar.number_input("Quantity", min_value=1, value=1, step=1)
    clock_mode = st.sidebar.radio("Simulator time", ["Current", "Replay past"])

    if clock_mode == "Current":
        refresh_seconds = st.sidebar.number_input(
            "Refresh seconds",
            min_value=1,
            value=config.LIVE_REFRESH_SECONDS,
            step=1,
        )
        if st.sidebar.button("Start live" if not state.clock_running else "Pause live"):
            state.clock_running = not state.clock_running
            state.fetcher.clear_cache()
            st.rerun()
        sim_time = datetime.now(timezone.utc)
    else:
        replay_date = st.sidebar.date_input("Replay date", value=date.today())
        replay_time = st.sidebar.time_input("Start time", value=time(9, 30))
        replay_timezone = st.sidebar.selectbox(
            "Replay timezone",
            [MARKET_TIMEZONE, LOCAL_TIMEZONE, "UTC"],
            index=0,
        )
        replay_speed = st.sidebar.number_input("Replay speed", min_value=1, value=1, step=1)
        refresh_seconds = config.REPLAY_REFRESH_SECONDS
        requested_start = datetime.combine(replay_date, replay_time).replace(
            tzinfo=ZoneInfo(replay_timezone)
        )

        c1, c2 = st.sidebar.columns(2)
        if c1.button("Start replay"):
            state.clock_running = True
            state.replay_current_time = requested_start
            state.replay_last_wall_time = datetime.now(timezone.utc)
            st.rerun()
        if c2.button("Pause"):
            state.clock_running = False
            st.rerun()

        if state.replay_current_time is None:
            state.replay_current_time = requested_start
        elif state.clock_running:
            now = datetime.now(timezone.utc)
            last_wall = state.replay_last_wall_time or now
            elapsed = (now - last_wall).total_seconds()
            state.replay_current_time += timedelta(seconds=elapsed * replay_speed)
            state.replay_last_wall_time = now
        sim_time = state.replay_current_time

    if not expiry:
        st.info("Enter an expiration date like 2026-07-17 to load an option chain.")
        return

    try:
        if clock_mode == "Current":
            spot = state.fetcher.get_spot(ticker)
        else:
            spot = state.fetcher.get_replay_spot(ticker, sim_time)
        rfr = state.fetcher.get_rfr()
        chain = state.fetcher.get_chain(ticker, expiry)
    except Exception as exc:
        st.error(f"Data fetch failed: {exc}")
        return

    priced_chain = _price_chain(
        chain,
        ticker,
        spot,
        rfr,
        sim_time,
        synthetic_market=clock_mode == "Replay past",
    )
    fills = _monitor_quotes(
        state.quotes,
        priced_chain,
        ticker,
        state.fill_sim,
        state.position_manager,
        int(quantity),
    )

    st.caption(
            f"Mode: {clock_mode} | Simulator time: {sim_time.isoformat()} | "
            f"{'running' if state.clock_running else 'paused'}"
    )
    for fill in fills:
        st.toast(f"Filled {fill.direction} {fill.quantity} {fill.contract.option_type} {fill.contract.strike} at {fill.price:.2f}")

    chain_tab, quote_tab, risk_tab = st.tabs(["Chain", "Quotes", "Risk"])

    with chain_tab:
        st.metric("Spot", f"{spot:.2f}")
        st.caption(
            "Replay times default to New York market time. Historical spot uses "
            "minute bars with second-by-second interpolation."
        )
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

        active_quotes = [
            {
                "ticker": key.ticker,
                "strike": key.strike,
                "expiry": key.expiry,
                "option_type": key.option_type,
                "bid": quote.bid,
                "ask": quote.ask,
            }
            for key, quote in state.quotes.items()
        ]
        st.subheader("Active Quotes")
        st.dataframe(pd.DataFrame(active_quotes), use_container_width=True)
        st.subheader("Trade Log")
        st.dataframe(_trade_log_frame(state.fill_sim.trade_log), use_container_width=True)

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

    if state.clock_running:
        time_module.sleep(float(refresh_seconds))
        if clock_mode == "Current":
            state.fetcher.clear_cache()
        st.rerun()


def _price_chain(
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
        mid = float(row.get("mid", 0) or 0)
        iv_result = solve_iv(mid, spot, strike, T, rfr, option_type) if mid > 0 else None
        iv = iv_result.implied_vol if iv_result else float(row.get("impliedVolatility", 0.30) or 0.30)
        bsm = price_bsm(spot, strike, T, rfr, iv, option_type)
        raw_bid = float(row.get("bid", 0) or 0)
        raw_ask = float(row.get("ask", 0) or 0)
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


def _monitor_quotes(
    quotes: dict[ContractKey, Quote],
    priced_chain: pd.DataFrame,
    ticker: str,
    fill_sim: FillSimulator,
    position_manager: PositionManager,
    quantity: int,
) -> list[object]:
    fills = []
    for _, row in priced_chain.iterrows():
        contract = _contract_key(ticker, row)
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


def _trade_log_frame(trades: list[object]) -> pd.DataFrame:
    rows = []
    for trade in trades:
        rows.append(
            {
                "timestamp": trade.timestamp,
                "ticker": trade.contract.ticker,
                "strike": trade.contract.strike,
                "expiry": trade.contract.expiry,
                "option_type": trade.contract.option_type,
                "direction": trade.direction,
                "quantity": trade.quantity,
                "price": trade.price,
            }
        )
    return pd.DataFrame(rows)
