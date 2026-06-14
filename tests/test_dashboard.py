from datetime import datetime, timezone

import pandas as pd
import pytest

from options_mm.ui.dashboard import _price_chain


def test_price_chain_can_generate_synthetic_replay_market():
    chain = pd.DataFrame(
        [
            {
                "contractSymbol": "SPY260717C00500000",
                "option_type": "call",
                "expiry": "2026-07-17",
                "strike": 500.0,
                "bid": 10.0,
                "ask": 10.2,
                "mid": 10.1,
                "impliedVolatility": 0.2,
            }
        ]
    )

    priced = _price_chain(
        chain,
        ticker="SPY",
        spot=500.0,
        rfr=0.04,
        as_of=datetime(2026, 6, 12, 14, 30, tzinfo=timezone.utc),
        synthetic_market=True,
    )

    assert priced.loc[0, "bid"] == pytest.approx(priced.loc[0, "fair_value"] - 0.1)
    assert priced.loc[0, "ask"] == pytest.approx(priced.loc[0, "fair_value"] + 0.1)


def test_synthetic_replay_market_moves_with_spot():
    chain = pd.DataFrame(
        [
            {
                "contractSymbol": "SPY260717C00500000",
                "option_type": "call",
                "expiry": "2026-07-17",
                "strike": 500.0,
                "bid": 10.0,
                "ask": 10.2,
                "mid": 10.1,
                "impliedVolatility": 0.2,
            }
        ]
    )
    as_of = datetime(2026, 6, 12, 14, 30, tzinfo=timezone.utc)

    lower_spot = _price_chain(chain, "SPY", 500.0, 0.04, as_of, synthetic_market=True)
    higher_spot = _price_chain(chain, "SPY", 505.0, 0.04, as_of, synthetic_market=True)

    assert higher_spot.loc[0, "bid"] > lower_spot.loc[0, "bid"]
    assert higher_spot.loc[0, "ask"] > lower_spot.loc[0, "ask"]
    assert higher_spot.loc[0, "mid"] > lower_spot.loc[0, "mid"]
