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

