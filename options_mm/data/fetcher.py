"""Market data ingestion with lightweight in-memory caching."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from options_mm import config


@dataclass
class CacheEntry:
    value: Any
    fetched_at: datetime


@dataclass
class DataFetcher:
    """Fetch spot, option chains, and risk-free rates.

    yfinance and FRED calls happen only when cache entries have expired. The
    cache is intentionally process-local because the simulator is interactive.
    """

    poll_interval_seconds: int = config.POLL_INTERVAL_SECONDS
    fred_api_key: str = config.FRED_API_KEY
    fred_series_id: str = config.FRED_SERIES_ID
    default_rfr: float = config.DEFAULT_RISK_FREE_RATE
    _cache: dict[tuple[Any, ...], CacheEntry] = field(default_factory=dict)

    def get_spot(self, ticker: str) -> float:
        key = ("spot", ticker.upper())
        cached = self._get_cached(key)
        if cached is not None:
            return float(cached)

        yf = _import_yfinance()
        ticker_obj = yf.Ticker(ticker)
        info = getattr(ticker_obj, "fast_info", {}) or {}
        spot = info.get("last_price") or info.get("lastPrice")

        if spot is None:
            history = ticker_obj.history(period="1d", interval="1m")
            if history.empty:
                raise ValueError(f"No spot price available for {ticker}")
            spot = history["Close"].dropna().iloc[-1]

        self._set_cached(key, float(spot))
        return float(spot)

    def get_chain(self, ticker: str, expiry: str) -> pd.DataFrame:
        key = ("chain", ticker.upper(), expiry)
        cached = self._get_cached(key)
        if cached is not None:
            return cached.copy()

        yf = _import_yfinance()
        chain = yf.Ticker(ticker).option_chain(expiry)
        calls = self._normalize_chain_side(chain.calls, "call", expiry)
        puts = self._normalize_chain_side(chain.puts, "put", expiry)
        combined = pd.concat([calls, puts], ignore_index=True)
        combined["mid"] = (combined["bid"] + combined["ask"]) / 2

        self._set_cached(key, combined)
        return combined.copy()

    def get_rfr(self) -> float:
        key = ("rfr", self.fred_series_id)
        cached = self._get_cached(key)
        if cached is not None:
            return float(cached)

        if not self.fred_api_key:
            self._set_cached(key, self.default_rfr)
            return self.default_rfr

        try:
            import requests

            response = requests.get(
                "https://api.stlouisfed.org/fred/series/observations",
                params={
                    "series_id": self.fred_series_id,
                    "api_key": self.fred_api_key,
                    "file_type": "json",
                    "sort_order": "desc",
                    "limit": 10,
                },
                timeout=10,
            )
            response.raise_for_status()
            observations = response.json().get("observations", [])
            rate = next(
                float(obs["value"]) / 100
                for obs in observations
                if obs.get("value") not in {None, "."}
            )
        except Exception:
            rate = self.default_rfr

        self._set_cached(key, rate)
        return rate

    def clear_cache(self) -> None:
        self._cache.clear()

    def _normalize_chain_side(
        self, frame: pd.DataFrame, option_type: str, expiry: str
    ) -> pd.DataFrame:
        normalized = frame.copy()
        normalized["option_type"] = option_type
        normalized["expiry"] = expiry
        return normalized

    def _get_cached(self, key: tuple[Any, ...]) -> Any | None:
        entry = self._cache.get(key)
        if entry is None:
            return None

        age = (datetime.now(timezone.utc) - entry.fetched_at).total_seconds()
        if age > self.poll_interval_seconds:
            self._cache.pop(key, None)
            return None
        return entry.value

    def _set_cached(self, key: tuple[Any, ...], value: Any) -> None:
        self._cache[key] = CacheEntry(value=value, fetched_at=datetime.now(timezone.utc))


def _import_yfinance():
    try:
        import yfinance as yf
    except ImportError as exc:
        raise ImportError("Install yfinance to fetch live market data") from exc
    return yf

