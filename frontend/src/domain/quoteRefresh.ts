import {
  chainRowToContract,
  contractId,
  parseContractId,
  type ChainRow,
  type Quote,
  type SpreadShape,
} from './models';
import { makeCustomQuote, makeShapedQuote } from './quoteEngine';

export function refreshAutoQuotes(
  quotes: Record<string, Quote>,
  chain: ChainRow[],
): Record<string, Quote> {
  const next = { ...quotes };

  for (const [id, quote] of Object.entries(next)) {
    if (!quote.spreadShape || quote.spreadShape === 'custom') continue;

    const contract = parseContractId(id);
    const row = chain.find(
      (r) => r.strike === contract.strike && r.option_type === contract.option_type,
    );
    if (!row) continue;

    const width = quote.spreadWidth ?? quote.spread;
    next[id] = makeShapedQuote(row.fair_value, width, quote.spreadShape, row.iv, {
      baseSpread: width,
    });
  }

  return next;
}

export function buildSpreadQuotes(
  chain: ChainRow[],
  ticker: string,
  strike: number,
  scope: 'both' | 'call' | 'put',
  shape: SpreadShape,
  spreadWidth: number,
  custom?: {
    callBid?: number;
    callAsk?: number;
    putBid?: number;
    putAsk?: number;
  },
): Record<string, Quote> {
  const quotes: Record<string, Quote> = {};

  const addLeg = (optionType: 'call' | 'put', bid?: number, ask?: number) => {
    const row = chain.find((r) => r.strike === strike && r.option_type === optionType);
    if (!row) return;

    const contract = chainRowToContract(ticker, row);
    const id = contractId(contract);

    if (shape === 'custom') {
      if ((bid ?? 0) <= 0 && (ask ?? 0) <= 0) return;
      quotes[id] = makeCustomQuote(bid ?? 0, ask ?? 0, row.fair_value);
      return;
    }

    quotes[id] = makeShapedQuote(row.fair_value, spreadWidth, shape, row.iv, {
      baseSpread: spreadWidth,
    });
  };

  if (scope === 'both' || scope === 'call') {
    addLeg('call', custom?.callBid, custom?.callAsk);
  }
  if (scope === 'both' || scope === 'put') {
    addLeg('put', custom?.putBid, custom?.putAsk);
  }

  return quotes;
}
