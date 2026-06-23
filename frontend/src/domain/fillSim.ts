import type { ContractKey, Quote, Trade } from './models';

export interface FillSimConfig {
  /** Per-second fill probability at the NBBO (before edge decay). */
  baseFillRatePerSecond: number;
  /** Exponential decay constant for quote edge vs market. */
  edgeDecayK: number;
  /** Ignore probabilistic fills when edge exceeds this (too far from market). */
  maxEdge: number;
  /** Price tolerance for treating quotes as at-touch or inside the market. */
  priceTolerance: number;
}

export const DEFAULT_FILL_SIM_CONFIG: FillSimConfig = {
  baseFillRatePerSecond: 0.15,
  edgeDecayK: 12,
  maxEdge: 0.25,
  priceTolerance: 0.005,
};

export function scaledFillRate(basePerSecond: number, tickSeconds: number): number {
  if (tickSeconds <= 0) return 0;
  if (basePerSecond <= 0) return 0;
  return 1 - (1 - Math.min(basePerSecond, 1)) ** tickSeconds;
}

/** Positive edge means worse than the market; zero means at NBBO; negative means inside. */
export function sellEdge(quoteAsk: number, marketAsk: number): number {
  return quoteAsk - marketAsk;
}

export function buyEdge(quoteBid: number, marketBid: number): number {
  return marketBid - quoteBid;
}

export function probabilisticFillChance(edge: number, config: FillSimConfig, tickSeconds: number): number {
  if (edge < -config.priceTolerance) {
    return 1;
  }
  if (edge > config.maxEdge) {
    return 0;
  }
  const atTouch = Math.abs(edge) <= config.priceTolerance;
  const edgePenalty = atTouch ? 0 : Math.max(0, edge);
  const base = scaledFillRate(config.baseFillRatePerSecond, tickSeconds);
  return Math.min(1, base * Math.exp(-config.edgeDecayK * edgePenalty));
}

export function seededRandom(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 4294967296;
}

export function checkFill(
  contract: ContractKey,
  quote: Quote,
  marketBid: number,
  marketAsk: number,
  quantity: number,
  timestamp: string,
  config: FillSimConfig = DEFAULT_FILL_SIM_CONFIG,
  tickSeconds = 1,
  rng: (seed: string) => number = seededRandom,
): Trade | null {
  if (quantity <= 0) {
    throw new Error('quantity must be positive');
  }

  const contractKey = `${contract.ticker}:${contract.expiry}:${contract.strike}:${contract.option_type}`;

  // Level 0: crossed market always fills.
  if (marketBid >= quote.ask) {
    return {
      contract,
      direction: 'sell',
      quantity,
      price: quote.ask,
      timestamp,
    };
  }

  if (marketAsk <= quote.bid) {
    return {
      contract,
      direction: 'buy',
      quantity,
      price: quote.bid,
      timestamp,
    };
  }

  // Level 2: probabilistic fills when competitive.
  const askEdge = sellEdge(quote.ask, marketAsk);
  const sellChance = probabilisticFillChance(askEdge, config, tickSeconds);
  if (sellChance > 0 && rng(`${timestamp}:${contractKey}:sell`) < sellChance) {
    return {
      contract,
      direction: 'sell',
      quantity,
      price: quote.ask,
      timestamp,
    };
  }

  const bidEdge = buyEdge(quote.bid, marketBid);
  const buyChance = probabilisticFillChance(bidEdge, config, tickSeconds);
  if (buyChance > 0 && rng(`${timestamp}:${contractKey}:buy`) < buyChance) {
    return {
      contract,
      direction: 'buy',
      quantity,
      price: quote.bid,
      timestamp,
    };
  }

  return null;
}

export function monitorQuotes(
  quotes: Record<string, Quote>,
  chainRows: Array<{
    contract: ContractKey;
    bid: number;
    ask: number;
  }>,
  quantity: number,
  timestamp: string,
  config: FillSimConfig = DEFAULT_FILL_SIM_CONFIG,
  tickSeconds = 1,
): { fills: Trade[]; remainingQuotes: Record<string, Quote> } {
  const remaining = { ...quotes };
  const fills: Trade[] = [];

  for (const row of chainRows) {
    const id = `${row.contract.ticker}:${row.contract.expiry}:${row.contract.strike}:${row.contract.option_type}`;
    const quote = remaining[id];
    if (!quote) continue;

    const trade = checkFill(
      row.contract,
      quote,
      row.bid,
      row.ask,
      quantity,
      timestamp,
      config,
      tickSeconds,
      seededRandom,
    );
    if (trade) {
      fills.push(trade);
      delete remaining[id];
    }
  }

  return { fills, remainingQuotes: remaining };
}
