from datetime import datetime, timezone

from options_mm.data.fetcher import CacheEntry, DataFetcher


def test_fetcher_returns_cached_rfr_when_fresh():
    fetcher = DataFetcher(poll_interval_seconds=60, fred_api_key="unused")
    fetcher._cache[("rfr", fetcher.fred_series_id)] = CacheEntry(
        value=0.042,
        fetched_at=datetime.now(timezone.utc),
    )

    assert fetcher.get_rfr() == 0.042


def test_fetcher_uses_default_rfr_without_fred_key():
    fetcher = DataFetcher(fred_api_key="", default_rfr=0.037)

    assert fetcher.get_rfr() == 0.037
