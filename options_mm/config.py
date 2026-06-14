"""Application configuration defaults."""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()

DEFAULT_SPREAD = 0.05
POLL_INTERVAL_SECONDS = 5
DEFAULT_TICKER = "SPY"
FRED_SERIES_ID = "DTB3"
FRED_API_KEY = os.getenv("FRED_API_KEY", "")
DEFAULT_RISK_FREE_RATE = 0.05
