import pytest

from options_mm.pricing.bsm import BSMResult, price_bsm


@pytest.mark.parametrize(
    ("option_type", "expected"),
    [
        (
            "call",
            BSMResult(
                fair_value=10.4506,
                delta=0.6368,
                gamma=0.0188,
                theta=-6.4140,
                vega=37.5240,
            ),
        ),
        (
            "put",
            BSMResult(
                fair_value=5.5735,
                delta=-0.3632,
                gamma=0.0188,
                theta=-1.6579,
                vega=37.5240,
            ),
        ),
    ],
)
def test_price_bsm_matches_known_calculator_values(option_type, expected):
    result = price_bsm(
        S=100,
        K=100,
        T=1,
        r=0.05,
        sigma=0.20,
        option_type=option_type,
    )

    assert result.fair_value == pytest.approx(expected.fair_value, abs=1e-4)
    assert result.delta == pytest.approx(expected.delta, abs=1e-4)
    assert result.gamma == pytest.approx(expected.gamma, abs=1e-4)
    assert result.theta == pytest.approx(expected.theta, abs=1e-4)
    assert result.vega == pytest.approx(expected.vega, abs=1e-4)


def test_price_bsm_rejects_invalid_option_type():
    with pytest.raises(ValueError, match="option_type"):
        price_bsm(S=100, K=100, T=1, r=0.05, sigma=0.20, option_type="straddle")


@pytest.mark.parametrize(
    ("field", "kwargs"),
    [
        ("S", {"S": 0}),
        ("K", {"K": 0}),
        ("T", {"T": 0}),
        ("sigma", {"sigma": 0}),
    ],
)
def test_price_bsm_rejects_non_positive_inputs(field, kwargs):
    inputs = {
        "S": 100,
        "K": 100,
        "T": 1,
        "r": 0.05,
        "sigma": 0.20,
        "option_type": "call",
    }
    inputs.update(kwargs)

    with pytest.raises(ValueError, match=field):
        price_bsm(**inputs)
