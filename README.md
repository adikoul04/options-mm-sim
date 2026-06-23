# DeltaGrid

**DeltaGrid** is a browser-based options market making simulator. Trade against live or replayed markets, quote strikes with configurable spreads, simulate fills, and track P&amp;L and portfolio Greeks in a dark trading-terminal UI.

Stack: **React + TypeScript** (simulation, UI, charts) and a thin **FastAPI** backend (market data + BSM pricing).

## Features

### Simulation modes

| Mode | Description |
|------|-------------|
| **Live** | Polls Yahoo Finance for spot and option chains on a configurable interval (default 5s). While the clock is running, bid/ask are repriced synthetically from BSM fair value + half-spread so the book moves with spot. |
| **Replay** | Steps through historical time from a chosen date, start time, and timezone. Spot is interpolated from minute bars; option markets are synthetic (BSM-repriced) because historical NBBO is not time-accurate. Adjustable replay speed (1×–100×). Pause and resume without losing session state. |

### Option chain

- Full chain for a ticker + expiry (YYYY-MM-DD)
- Per-strike **bid / ask / mid**, **implied vol**, **BSM fair value**, and **Greeks** (delta, gamma, theta, vega)
- Filter calls, puts, or both
- **Spot chart** on the Chain tab with pan/zoom and auto-scrolling time axis

### Quoting

- Quote by **strike** — call only, put only, or both legs
- **Spread shapes**: balanced, left-skewed, right-skewed, or fully **custom** bid/ask
- Configurable **spread width** and **quantity**
- **Auto-refresh**: non-custom quotes reprice each tick from updated fair value
- **Market status** panel per leg (bid, ask, fair, mid) or “No market data for this strike.”
- Active quotes table with remove action

### Fill simulation

Two levels of fill logic (client-side):

1. **Level 0 — crossed market**: if your ask ≤ market bid or your bid ≥ market ask, you fill immediately at your quote.
2. **Level 2 — probabilistic**: competitive quotes fill with probability that decays with edge vs. the NBBO (configurable base rate, decay constant, max edge).

Fills remove the quote, update positions, and surface in the status bar (last 3 alerts).

### Portfolio &amp; risk

- **P&amp;L**: mark-to-market — `cash + Σ(qty × fair_value × 100)` per contract
- **Net Greeks**: `Σ(qty × 100 × greek)` over open positions
- Closed positions contribute realized cash only (no stale marks)
- **P&amp;L** and **net quantity** time-series charts (side by side on Quotes tab)
- Trade blotter with timestamp, contract, side, qty, and price

### Charts &amp; viewport

- X-axis: seconds since simulation start
  - Grows from 0 → now until **1000s** (spot) or **500s** (P&amp;L / quantity), then slides a **100s** or **50s** window
  - User panning is preserved until you return to the live edge
- Y-axis: recomputed from visible data, rounded to sensible steps

### Persistence

Sidebar settings (ticker, expiry, mode, replay prefs, default spread/qty) are saved to `localStorage` under `deltagrid-settings`.

## Architecture

```
deltagrid/
├── backend/                 # Thin FastAPI data API
│   └── app/
│       ├── main.py          # App entry, CORS
│       ├── routes.py        # Market data endpoints
│       └── schemas.py       # Response models
├── frontend/                # React + TypeScript + Vite
│   └── src/
│       ├── api/             # HTTP client (VITE_API_BASE)
│       ├── domain/          # Fills, positions, quotes, chart viewport
│       ├── store/           # Zustand simulation state
│       ├── hooks/           # Simulation tick loop
│       ├── components/      # UI building blocks
│       └── tabs/            # Chain, Quotes
├── options_mm/              # Python pricing & data layer
│   ├── data/fetcher.py      # yfinance + FRED
│   ├── pricing/             # BSM + IV solver
│   ├── engine/              # Quote, fill, position engines (Python tests)
│   └── services/chain.py    # Chain pricing orchestration
├── scripts/dev.sh           # Start backend + frontend
└── tests/                   # pytest suite
```

### Responsibility split

| Layer | Owns | Does not own |
|-------|------|--------------|
| **Backend** | Spot, chain, RFR, replay spot; BSM/IV via scipy | UI state, quotes, positions, chart viewport |
| **Frontend domain** | Fill simulation, positions, P&amp;L/Greeks, chart viewport, quote refresh | External API keys, scipy pricing |
| **Frontend UI** | Tabs, sidebar, tables, Plotly charts | Market data fetching logic |

### API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/spot?ticker=` | Live spot price |
| `GET /api/rfr` | Risk-free rate (FRED or default) |
| `GET /api/chain?ticker=&expiry=&spot=&as_of=&synthetic=` | Priced option chain |
| `GET /api/replay/spot?ticker=&timestamp=` | Interpolated replay spot |
| `POST /api/cache/clear` | Clear data cache (live mode) |

Interactive docs: `http://localhost:8000/docs`

## Setup

**Requirements:** Python 3.11+, Node 20+

```bash
# Python (repo root)
python -m pip install -r requirements.txt
cp .env.example .env   # optional FRED_API_KEY for live Treasury rates

# Frontend
cd frontend && npm install
```

## Run locally

**Option A — one script:**

```bash
./scripts/dev.sh
```

**Option B — two terminals:**

```bash
# Terminal 1 — API on :8000
python -m uvicorn backend.app.main:app --reload --port 8000

# Terminal 2 — UI on :5173 (proxies /api → backend)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Test

```bash
# Backend + Python domain
python -m pytest

# Frontend domain logic
cd frontend && npm test
```

## Usage

1. Enter **ticker** (e.g. `SPY`) and **expiry** (`YYYY-MM-DD`) in the sidebar.
2. Choose **Live** or **Replay**, configure time settings, and start the clock.
3. **Chain** tab — spot chart and full option chain.
4. **Quotes** tab — portfolio metrics, P&amp;L/quantity charts, strike quoting, active quotes, and trade history.
5. Send quotes; watch fills and risk update each tick.

## Configuration

| Variable | Where | Purpose |
|----------|-------|---------|
| `FRED_API_KEY` | `.env` (backend) | Live risk-free rate from FRED; falls back to a default if unset |
| `ALLOWED_ORIGINS` | `.env` (backend) | Comma-separated CORS origins for production frontend URLs |
| `VITE_API_BASE` | frontend build env | API base URL (default `/api` for local Vite proxy) |

## Hosting (free tier)

DeltaGrid is a **split deployment**: static React frontend + Python API. Both can be hosted for **$0** on common free tiers, with tradeoffs.

### Recommended layout

| Piece | Service | Why |
|-------|---------|-----|
| **Frontend** | [Cloudflare Pages](https://pages.cloudflare.com/), [Vercel](https://vercel.com/), or [Netlify](https://www.netlify.com/) | Free static hosting, global CDN, easy GitHub deploy |
| **Backend** | [Render](https://render.com/) free web service | Straightforward Python/FastAPI deploy; `render.yaml` included |

### Frontend deploy

1. Connect the GitHub repo to your static host.
2. **Root directory:** `frontend`
3. **Build command:** `npm ci && npm run build`
4. **Output directory:** `dist`
5. **Environment variable:** `VITE_API_BASE=https://YOUR-API-URL.onrender.com/api` (no trailing slash on host; path must end with `/api`)

SPA routing: all hosts above serve `index.html` for client-side routes by default on Vite builds.

### Backend deploy (Render example)

1. Create a **Web Service** from the same repo (or use the included `render.yaml` blueprint).
2. **Start command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
3. **Environment:**
   - `FRED_API_KEY` (optional)
   - `ALLOWED_ORIGINS=https://your-frontend.pages.dev` (exact origin, no trailing slash)
4. After deploy, set `VITE_API_BASE` on the frontend to `https://<service>.onrender.com/api` and redeploy the frontend.

### Free-tier caveats

- **Render free** services **spin down after ~15 minutes** of inactivity — first request after idle can take 30–60s (cold start).
- **Yahoo Finance** (`yfinance`) is unofficial and rate-limited; a public demo may hit throttling under heavy use.
- **No auth** — single-user, in-memory cache; fine for a personal demo, not for multi-tenant production.
- **Replay** depends on Yahoo minute history availability (typically lags a few trading days).

### Alternatives

| Provider | Frontend | Backend | Notes |
|----------|----------|---------|-------|
| **Fly.io** | — | Yes | Small free allowance; always-on possible with limits |
| **Railway** | — | Yes | Limited monthly credit |
| **PythonAnywhere** | — | Yes | Free tier is restrictive (no long-running websockets; OK for REST) |
| **GitHub Codespaces** | — | — | Good for demos, not permanent public hosting |

### Single-host option (advanced)

Run FastAPI and serve the Vite `dist/` from the same process (or put nginx in front). Simpler CORS but couples releases; not set up out of the box in this repo.

## Tradeoffs &amp; assumptions

- Pricing stays in **Python** (scipy BSM + IV solver); the browser runs simulation state only.
- Replay option markets are **synthetic** — educational simulation, not historical tape accuracy.
- Live running mode reprices displayed bid/ask from fair value so the book reacts to spot between chain refreshes.
- Theta from BSM is the model’s annualized value; the UI shows aggregated raw theta.

## License

See repository license file.
