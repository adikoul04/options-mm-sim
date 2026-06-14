import pytest

from options_mm.pricing.bsm import price_bsm
from options_mm.pricing.iv_solver import solve_iv


@pytest.mark.parametrize("option_type", ["call", "put"])
def test_solve_iv_recovers_known_vol(option_type):
    market_price = price_bsm(100, 105, 0.5, 0.04, 0.32, option_type).fair_value

    result = solve_iv(market_price, 100, 105, 0.5, 0.04, option_type)

    assert result.converged is True
    assert result.implied_vol == pytest.approx(0.32, abs=1e-5)


def test_solve_iv_rejects_non_positive_market_price():
    with pytest.raises(ValueError, match="market_price"):
        solve_iv(0, 100, 100, 1, 0.05, "call")

