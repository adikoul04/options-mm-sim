import pytest

from options_mm.engine.fill_sim import ContractKey, FillSimulator, Trade
from options_mm.engine.position import CONTRACT_MULTIPLIER, PositionManager
from options_mm.engine.quote_engine import Quote, QuoteEngine
from options_mm.pricing.bsm import BSMResult


def test_quote_engine_centers_quote_around_fair_value():
    quote = QuoteEngine(base_spread=0.10).make_quote(2.50)

    assert quote.bid == pytest.approx(2.45)
    assert quote.ask == pytest.approx(2.55)
    assert quote.spread == pytest.approx(0.10)


def test_fill_simulator_records_sell_when_market_bid_crosses_ask():
    contract = ContractKey("SPY", 500, "2026-07-17", "call")
    simulator = FillSimulator()

    trade = simulator.check_fill(
        contract,
        Quote(bid=2.45, ask=2.55, fair_value=2.50, spread=0.10),
        market_bid=2.60,
        market_ask=2.65,
        quantity=3,
    )

    assert trade is not None
    assert trade.direction == "sell"
    assert trade.signed_quantity == -3
    assert simulator.trade_log == [trade]


def test_fill_simulator_records_buy_when_market_ask_crosses_bid():
    contract = ContractKey("SPY", 500, "2026-07-17", "call")
    simulator = FillSimulator()

    trade = simulator.check_fill(
        contract,
        Quote(bid=2.45, ask=2.55, fair_value=2.50, spread=0.10),
        market_bid=2.35,
        market_ask=2.40,
    )

    assert trade is not None
    assert trade.direction == "buy"
    assert trade.signed_quantity == 1


def test_position_manager_tracks_pnl_and_greeks():
    contract = ContractKey("SPY", 500, "2026-07-17", "call")
    manager = PositionManager()
    trade = Trade(contract, "buy", 2, 2.00, timestamp=None)

    manager.record_trade(trade)
    snapshot = manager.snapshot(
        marks={contract: 2.25},
        greeks={
            contract: BSMResult(
                fair_value=2.25,
                delta=0.50,
                gamma=0.02,
                theta=-0.10,
                vega=0.30,
            )
        },
    )

    assert snapshot.pnl == pytest.approx(2 * (2.25 - 2.00) * CONTRACT_MULTIPLIER)
    assert snapshot.net_delta == pytest.approx(100)
    assert snapshot.net_gamma == pytest.approx(4)
    assert snapshot.net_theta == pytest.approx(-20)
    assert snapshot.net_vega == pytest.approx(60)

