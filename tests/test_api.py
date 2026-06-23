"""Tests for the thin FastAPI backend."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@patch("backend.app.routes._fetcher")
def test_get_rfr(mock_fetcher: MagicMock):
    mock_fetcher.get_rfr.return_value = 0.045
    response = client.get("/api/rfr")
    assert response.status_code == 200
    assert response.json()["rate"] == 0.045


@patch("backend.app.routes._fetcher")
def test_get_spot(mock_fetcher: MagicMock):
    mock_fetcher.get_spot.return_value = 501.25
    response = client.get("/api/spot?ticker=SPY")
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "SPY"
    assert data["spot"] == 501.25


@patch("backend.app.routes.price_chain")
@patch("backend.app.routes._fetcher")
def test_get_chain(mock_fetcher: MagicMock, mock_price_chain: MagicMock):
    mock_fetcher.get_rfr.return_value = 0.04
    mock_fetcher.get_spot.return_value = 500.0
    mock_fetcher.get_chain.return_value = pd.DataFrame(
        [
            {
                "contractSymbol": "SPY260717C00500000",
                "option_type": "call",
                "expiry": "2026-07-17",
                "strike": 500.0,
                "bid": 10.0,
                "ask": 10.2,
                "mid": 10.1,
            }
        ]
    )
    mock_price_chain.return_value = pd.DataFrame(
        [
            {
                "contractSymbol": "SPY260717C00500000",
                "option_type": "call",
                "expiry": "2026-07-17",
                "strike": 500.0,
                "bid": 9.9,
                "ask": 10.1,
                "mid": 10.0,
                "iv": 0.2,
                "fair_value": 10.0,
                "delta": 0.5,
                "gamma": 0.01,
                "theta": -0.05,
                "vega": 0.1,
            }
        ]
    )

    response = client.get("/api/chain?ticker=SPY&expiry=2026-07-17")
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "SPY"
    assert len(data["rows"]) == 1
    assert data["rows"][0]["strike"] == 500.0
