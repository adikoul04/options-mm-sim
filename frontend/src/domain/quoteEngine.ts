import type { Quote, SpreadShape } from './models';

export interface QuoteEngineConfig {
  baseSpread: number;
  ivSpreadMultiplier?: number;
  minBid?: number;
}

const SKEW_WEIGHTS: Record<Exclude<SpreadShape, 'custom'>, { bid: number; ask: number }> = {
  balanced: { bid: 0.5, ask: 0.5 },
  left_skewed: { bid: 0.75, ask: 0.25 },
  right_skewed: { bid: 0.25, ask: 0.75 },
};

export function makeQuote(
  fairValue: number,
  spread: number,
  iv?: number,
  config: QuoteEngineConfig = { baseSpread: spread },
): Quote {
  return makeShapedQuote(fairValue, spread, 'balanced', iv, config);
}

export function makeShapedQuote(
  fairValue: number,
  spreadWidth: number,
  shape: Exclude<SpreadShape, 'custom'>,
  iv?: number,
  config: QuoteEngineConfig = { baseSpread: spreadWidth },
): Quote {
  if (fairValue < 0) {
    throw new Error('fair_value cannot be negative');
  }

  let totalSpread = config.baseSpread ?? spreadWidth;
  if (iv !== undefined && config.ivSpreadMultiplier) {
    totalSpread += Math.max(iv, 0) * config.ivSpreadMultiplier;
  }

  const weights = SKEW_WEIGHTS[shape];
  const minBid = config.minBid ?? 0.01;
  const bid = Math.max(minBid, fairValue - totalSpread * weights.bid);
  const ask = Math.max(bid + 0.01, fairValue + totalSpread * weights.ask);

  return {
    bid: round4(bid),
    ask: round4(ask),
    fair_value: fairValue,
    spread: totalSpread,
    spreadShape: shape,
    spreadWidth: spreadWidth,
  };
}

export function makeCustomQuote(
  bid: number,
  ask: number,
  fairValue: number,
): Quote {
  const spread = ask > bid ? ask - bid : 0;
  return {
    bid,
    ask,
    fair_value: fairValue,
    spread,
    spreadShape: 'custom',
  };
}

export function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
