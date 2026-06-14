# Options Market Making Simulator

A Python simulator for option market making workflows: live-ish market data ingestion, Black-Scholes-Merton pricing, implied volatility solving, quote generation, fill simulation, and a Streamlit risk dashboard.

## Features

- Fetches spot prices and option chains from `yfinance`
- Fetches the 13-week T-bill yield from FRED when `FRED_API_KEY` is configured
- Prices calls and puts with Black-Scholes-Merton
- Computes delta, gamma, annualized theta, and vega analytically
- Solves implied volatility with Newton-Raphson and a `brentq` fallback
- Generates passive bid/ask quotes around fair value
- Simulates fills when market prices cross your quotes
- Tracks positions, P&L, and aggregate Greeks
- Provides a Streamlit dashboard with chain, quote, and risk tabs
- Supports live polling mode and historical replay mode

## Setup

```bash
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set:

```bash
FRED_API_KEY=your_fred_api_key_here
```

The app falls back to `DEFAULT_RISK_FREE_RATE` in `options_mm/config.py` if no FRED key is set.

## Run

```bash
python -m streamlit run options_mm/main.py
```

Then open the local URL printed by Streamlit.

## Simulator Time

The sidebar includes two clock modes:

- `Current`: polls yfinance/FRED on a refresh interval and automatically reruns the dashboard while live mode is running.
- `Replay past`: choose a historical date and start time, then play the underlying forward second by second. Replay times default to New York market time, so `9:30` means the U.S. equity market open. yfinance provides intraday minute bars, so replay interpolates the underlying price between minute closes and reprices the option chain from that simulated spot.

Active quotes are monitored on every clock tick. If the simulated/live market crosses your quote, the fill is recorded and positions, P&L, and Greeks update on the next dashboard run.

## Test

```bash
python -m pytest
```

## Project Layout

```text
options_mm/
├── data/
│   └── fetcher.py
├── pricing/
│   ├── bsm.py
│   └── iv_solver.py
├── engine/
│   ├── quote_engine.py
│   ├── fill_sim.py
│   └── position.py
├── ui/
│   └── dashboard.py
├── config.py
└── main.py
```
