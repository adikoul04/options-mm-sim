"""Pydantic schemas for API responses."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    status: str = "ok"


class SpotResponse(BaseModel):
    ticker: str
    spot: float


class RfrResponse(BaseModel):
    rate: float


class ChainRow(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    contractSymbol: str
    option_type: str
    expiry: str
    strike: float
    bid: float
    ask: float
    mid: float
    iv: float
    fair_value: float
    delta: float
    gamma: float
    theta: float
    vega: float


class ChainResponse(BaseModel):
    ticker: str
    expiry: str
    spot: float
    rfr: float
    as_of: str
    synthetic_market: bool
    rows: list[ChainRow]
