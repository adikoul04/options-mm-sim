export type OptionType = 'call' | 'put';
export type SimMode = 'live' | 'replay';
export type OptionTypeFilter = 'both' | 'call' | 'put';
export type SpreadScope = 'both' | 'call' | 'put';
export type SpreadShape = 'balanced' | 'left_skewed' | 'right_skewed' | 'custom';

export interface ContractKey {
  ticker: string;
  strike: number;
  expiry: string;
  option_type: OptionType;
}

export interface Quote {
  bid: number;
  ask: number;
  fair_value: number;
  spread: number;
  spreadShape?: SpreadShape;
  spreadWidth?: number;
}

export interface Trade {
  contract: ContractKey;
  direction: 'buy' | 'sell';
  quantity: number;
  price: number;
  timestamp: string;
}

export interface Position {
  quantity: number;
  cash: number;
}

export interface RiskSnapshot {
  pnl: number;
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  positions: Record<string, number>;
}

export interface TimeSample {
  timeSinceStart: number;
  value: number;
}

export interface ChartViewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  atLiveEdge: boolean;
}

export interface ChainRow {
  contractSymbol: string;
  option_type: OptionType;
  expiry: string;
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  iv: number;
  fair_value: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export const CONTRACT_MULTIPLIER = 100;

export function contractId(contract: ContractKey): string {
  return `${contract.ticker}:${contract.expiry}:${contract.strike}:${contract.option_type}`;
}

export function parseContractId(id: string): ContractKey {
  const [ticker, expiry, strike, option_type] = id.split(':');
  return {
    ticker,
    expiry,
    strike: Number(strike),
    option_type: option_type as OptionType,
  };
}

export function chainRowToContract(ticker: string, row: ChainRow): ContractKey {
  return {
    ticker,
    strike: row.strike,
    expiry: row.expiry,
    option_type: row.option_type,
  };
}
