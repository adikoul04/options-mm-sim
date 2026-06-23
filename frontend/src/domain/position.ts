import {
  chainRowToContract,
  CONTRACT_MULTIPLIER,
  contractId,
  parseContractId,
  type ChainRow,
  type RiskSnapshot,
  type Trade,
} from './models';

export interface PositionState {
  quantity: number;
  cash: number;
}

export type PositionsMap = Record<string, PositionState>;

export interface GreekInputs {
  fair_value: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

/** Cash + mark-to-market: P&L = Σ(cash + qty × mark × multiplier). */
export function markToMarket(
  positions: PositionsMap,
  marks: Record<string, number>,
): number {
  let pnl = 0;
  for (const [id, position] of Object.entries(positions)) {
    const mark = position.quantity !== 0 ? (marks[id] ?? 0) : 0;
    pnl += position.cash + position.quantity * mark * CONTRACT_MULTIPLIER;
  }
  return pnl;
}

/**
 * Portfolio Greeks: Σ(qty × multiplier × greek) over open positions.
 * Delta = share-equivalent exposure; gamma/theta/vega in contract-dollar terms.
 */
export function aggregateGreeks(
  positions: PositionsMap,
  greeks: Record<string, GreekInputs>,
): Pick<RiskSnapshot, 'netDelta' | 'netGamma' | 'netTheta' | 'netVega'> {
  let netDelta = 0;
  let netGamma = 0;
  let netTheta = 0;
  let netVega = 0;

  for (const [id, position] of Object.entries(positions)) {
    if (position.quantity === 0) continue;
    const greek = greeks[id];
    if (!greek) continue;
    const multiplier = position.quantity * CONTRACT_MULTIPLIER;
    netDelta += greek.delta * multiplier;
    netGamma += greek.gamma * multiplier;
    netTheta += greek.theta * multiplier;
    netVega += greek.vega * multiplier;
  }

  return { netDelta, netGamma, netTheta, netVega };
}

export function snapshot(
  positions: PositionsMap,
  marks: Record<string, number>,
  greeks: Record<string, GreekInputs>,
): RiskSnapshot {
  const totals = aggregateGreeks(positions, greeks);
  const openPositions: Record<string, number> = {};

  for (const [id, position] of Object.entries(positions)) {
    if (position.quantity !== 0) {
      openPositions[id] = position.quantity;
    }
  }

  return {
    pnl: markToMarket(positions, marks),
    ...totals,
    positions: openPositions,
  };
}

export function recordTrade(positions: PositionsMap, trade: Trade): PositionsMap {
  const id = contractId(trade.contract);
  const current = positions[id] ?? { quantity: 0, cash: 0 };
  const signedQty = trade.direction === 'buy' ? trade.quantity : -trade.quantity;

  return {
    ...positions,
    [id]: {
      quantity: current.quantity + signedQty,
      cash: current.cash - signedQty * trade.price * CONTRACT_MULTIPLIER,
    },
  };
}

export function buildRiskInputs(
  ticker: string,
  chainRows: ChainRow[],
  positions: PositionsMap = {},
): { marks: Record<string, number>; greeks: Record<string, GreekInputs> } {
  const marks: Record<string, number> = {};
  const greeks: Record<string, GreekInputs> = {};

  for (const row of chainRows) {
    const contract = chainRowToContract(ticker, row);
    const id = contractId(contract);
    marks[id] = row.fair_value;
    greeks[id] = {
      fair_value: row.fair_value,
      delta: row.delta,
      gamma: row.gamma,
      theta: row.theta,
      vega: row.vega,
    };
  }

  // Ensure open positions use the latest chain marks even if strike keying differs slightly.
  for (const [id, position] of Object.entries(positions)) {
    if (position.quantity === 0 || marks[id] !== undefined) continue;
    const contract = parseContractId(id);
    const row = chainRows.find(
      (r) =>
        r.strike === contract.strike &&
        r.option_type === contract.option_type &&
        r.expiry === contract.expiry,
    );
    if (!row) continue;
    marks[id] = row.fair_value;
    greeks[id] = {
      fair_value: row.fair_value,
      delta: row.delta,
      gamma: row.gamma,
      theta: row.theta,
      vega: row.vega,
    };
  }

  return { marks, greeks };
}
