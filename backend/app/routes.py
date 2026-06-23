"""Thin API routes for market data access."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from backend.app.schemas import ChainResponse, ChainRow, HealthResponse, RfrResponse, SpotResponse
from options_mm.data.fetcher import DataFetcher
from options_mm.services.chain import price_chain

router = APIRouter()
_fetcher = DataFetcher()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@router.get("/spot", response_model=SpotResponse)
def get_spot(ticker: str = Query(..., min_length=1)) -> SpotResponse:
    try:
        spot = _fetcher.get_spot(ticker.upper())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return SpotResponse(ticker=ticker.upper(), spot=spot)


@router.get("/rfr", response_model=RfrResponse)
def get_rfr() -> RfrResponse:
    return RfrResponse(rate=_fetcher.get_rfr())


@router.get("/chain", response_model=ChainResponse)
def get_chain(
    ticker: str = Query(..., min_length=1),
    expiry: str = Query(..., min_length=1),
    spot: float | None = Query(None),
    as_of: str | None = Query(None, description="ISO8601 timestamp"),
    synthetic: bool = Query(False),
) -> ChainResponse:
    ticker = ticker.upper()
    try:
        rfr = _fetcher.get_rfr()
        if spot is None:
            spot = _fetcher.get_spot(ticker)
        chain = _fetcher.get_chain(ticker, expiry)
        as_of_dt = _parse_as_of(as_of)
        priced = price_chain(chain, ticker, spot, rfr, as_of_dt, synthetic_market=synthetic)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    rows = [
        ChainRow(
            contractSymbol=str(row["contractSymbol"]),
            option_type=str(row["option_type"]),
            expiry=str(row["expiry"]),
            strike=float(row["strike"]),
            bid=float(row["bid"]),
            ask=float(row["ask"]),
            mid=float(row["mid"]),
            iv=float(row["iv"]),
            fair_value=float(row["fair_value"]),
            delta=float(row["delta"]),
            gamma=float(row["gamma"]),
            theta=float(row["theta"]),
            vega=float(row["vega"]),
        )
        for _, row in priced.iterrows()
    ]
    return ChainResponse(
        ticker=ticker,
        expiry=expiry,
        spot=spot,
        rfr=rfr,
        as_of=as_of_dt.isoformat(),
        synthetic_market=synthetic,
        rows=rows,
    )


@router.get("/replay/spot", response_model=SpotResponse)
def get_replay_spot(
    ticker: str = Query(..., min_length=1),
    timestamp: str = Query(..., description="ISO8601 replay timestamp"),
) -> SpotResponse:
    ticker = ticker.upper()
    try:
        as_of = _parse_as_of(timestamp)
        spot = _fetcher.get_replay_spot(ticker, as_of)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return SpotResponse(ticker=ticker, spot=spot)


@router.post("/cache/clear")
def clear_cache() -> dict[str, str]:
    _fetcher.clear_cache()
    return {"status": "cleared"}


def _parse_as_of(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed
