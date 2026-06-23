import { describe, expect, it } from 'vitest';

import {
  computeYRange,
  GROWTH_PHASE_MAX_TIME,
  isAtLiveEdge,
  nextViewport,
  resolveXRange,
  roundAxisRange,
  SLIDING_WINDOW_WIDTH,
} from './chartViewport';
import {
  checkFill,
  DEFAULT_FILL_SIM_CONFIG,
  probabilisticFillChance,
  seededRandom,
  sellEdge,
} from './fillSim';
import { makeQuote, makeShapedQuote } from './quoteEngine';
import { markToMarket, recordTrade, snapshot } from './position';
import { zonedTimeToUtcIso } from './time';

describe('resolveXRange', () => {
  it('grows from 0 while under growth phase max', () => {
    expect(resolveXRange(null, 250, false)).toEqual([0, 250]);
  });

  it('uses sliding window after growth phase max', () => {
    expect(resolveXRange(null, 1500, false)).toEqual([1500 - SLIDING_WINDOW_WIDTH, 1500]);
  });

  it('preserves user pan when not at live edge', () => {
    expect(resolveXRange([100, 600], 1500, true)).toEqual([100, 600]);
  });

  it('follows live edge when within tolerance after user pan', () => {
    expect(resolveXRange([1400, 1499], 1500, true)).toEqual([1400, 1500]);
  });

  it('follows large time jumps when user has not panned', () => {
    expect(resolveXRange([0, 50], 150, false)).toEqual([0, 150]);
    expect(resolveXRange([0, 900], 1100, false)).toEqual([1000, 1100]);
  });

  it('switches to sliding window at growth phase boundary', () => {
    expect(resolveXRange(null, GROWTH_PHASE_MAX_TIME, false)).toEqual([0, GROWTH_PHASE_MAX_TIME]);
    expect(resolveXRange(null, GROWTH_PHASE_MAX_TIME + 1, false)).toEqual([
      GROWTH_PHASE_MAX_TIME + 1 - SLIDING_WINDOW_WIDTH,
      GROWTH_PHASE_MAX_TIME + 1,
    ]);
  });
});

describe('isAtLiveEdge', () => {
  it('detects live edge within tolerance', () => {
    expect(isAtLiveEdge(999, 1000)).toBe(true);
    expect(isAtLiveEdge(900, 1000)).toBe(false);
  });
});

describe('roundAxisRange', () => {
  it('rounds to nearest 10', () => {
    expect(roundAxisRange(523, 547)).toEqual([520, 550]);
  });
});

describe('computeYRange', () => {
  it('returns rounded range for values', () => {
    expect(computeYRange([501.2, 509.8])).toEqual([500, 510]);
  });

  it('uses integer steps for quantity charts', () => {
    expect(computeYRange([0, 3, 7], 1)).toEqual([0, 7]);
  });
});

describe('nextViewport', () => {
  it('always recomputes y-axis from recorded values', () => {
    const first = nextViewport({ xRange: null, yRange: null, userPanned: false }, 10, [500, 505]);
    expect(first.yRange).toEqual([500, 510]);

    const second = nextViewport(first, 20, [500, 505, 548]);
    expect(second.yRange).toEqual([500, 550]);
  });

  it('grows x-axis from 0 during early phase', () => {
    const viewport = nextViewport({ xRange: null, yRange: null, userPanned: false }, 42, [100]);
    expect(viewport.xRange).toEqual([0, 42]);
  });
});

describe('makeQuote', () => {
  it('centers quote around fair value', () => {
    const quote = makeQuote(10, 0.2);
    expect(quote.bid).toBeCloseTo(9.9);
    expect(quote.ask).toBeCloseTo(10.1);
  });
});

describe('makeShapedQuote', () => {
  it('skews spread left', () => {
    const quote = makeShapedQuote(10, 1, 'left_skewed');
    expect(quote.bid).toBeCloseTo(9.25);
    expect(quote.ask).toBeCloseTo(10.25);
  });

  it('skews spread right', () => {
    const quote = makeShapedQuote(10, 1, 'right_skewed');
    expect(quote.bid).toBeCloseTo(9.75);
    expect(quote.ask).toBeCloseTo(10.75);
  });
});

describe('checkFill', () => {
  const contract = {
    ticker: 'SPY',
    strike: 500,
    expiry: '2026-07-17',
    option_type: 'call' as const,
  };

  it('fills sell when market bid crosses ask', () => {
    const trade = checkFill(
      contract,
      { bid: 9.5, ask: 10, fair_value: 9.75, spread: 0.5 },
      10.1,
      10.2,
      1,
      '2026-01-01T00:00:00Z',
    );
    expect(trade?.direction).toBe('sell');
  });

  it('fills buy when market ask crosses bid', () => {
    const trade = checkFill(
      contract,
      { bid: 9.5, ask: 10, fair_value: 9.75, spread: 0.5 },
      9.4,
      9.45,
      1,
      '2026-01-01T00:00:00Z',
    );
    expect(trade?.direction).toBe('buy');
  });

  it('can probabilistically fill at the NBBO', () => {
    const config = { ...DEFAULT_FILL_SIM_CONFIG, baseFillRatePerSecond: 1 };
    const trade = checkFill(
      contract,
      { bid: 9.5, ask: 10, fair_value: 9.75, spread: 0.5 },
      9.5,
      10,
      1,
      '2026-01-01T00:00:00Z',
      config,
      1,
      () => 0,
    );
    expect(trade?.direction).toBe('sell');
  });

  it('does not fill when quote is far from the market', () => {
    const trade = checkFill(
      contract,
      { bid: 7, ask: 11, fair_value: 9, spread: 4 },
      9,
      10,
      1,
      '2026-01-01T00:00:00Z',
      DEFAULT_FILL_SIM_CONFIG,
      1,
      () => 0,
    );
    expect(trade).toBeNull();
  });
});

describe('probabilisticFillChance', () => {
  it('decays with edge', () => {
    const atTouch = probabilisticFillChance(0, DEFAULT_FILL_SIM_CONFIG, 1);
    const behind = probabilisticFillChance(0.02, DEFAULT_FILL_SIM_CONFIG, 1);
    expect(atTouch).toBeGreaterThan(behind);
  });

  it('fills inside quotes immediately', () => {
    expect(probabilisticFillChance(-0.02, DEFAULT_FILL_SIM_CONFIG, 1)).toBe(1);
  });
});

describe('seededRandom', () => {
  it('is deterministic for the same seed', () => {
    expect(seededRandom('abc')).toBe(seededRandom('abc'));
    expect(seededRandom('abc')).not.toBe(seededRandom('abd'));
  });
});

describe('sellEdge', () => {
  it('is zero at the best ask', () => {
    expect(sellEdge(1.1, 1.1)).toBe(0);
  });
});

describe('position accounting', () => {
  const contract = {
    ticker: 'SPY',
    strike: 500,
    expiry: '2026-07-17',
    option_type: 'call' as const,
  };

  it('marks open positions to market and keeps realized cash', () => {
    let positions = recordTrade({}, {
      contract,
      direction: 'buy',
      quantity: 2,
      price: 2,
      timestamp: 't',
    });
    const id = 'SPY:2026-07-17:500:call';
    const marks = { [id]: 2.25 };
    const greeks = {
      [id]: { fair_value: 2.25, delta: 0.5, gamma: 0.02, theta: -0.1, vega: 0.3 },
    };

    expect(markToMarket(positions, marks)).toBeCloseTo(50);
    const risk = snapshot(positions, marks, greeks);
    expect(risk.pnl).toBeCloseTo(50);
    expect(risk.netDelta).toBeCloseTo(100);
    expect(risk.netGamma).toBeCloseTo(4);
    expect(risk.netTheta).toBeCloseTo(-20);
    expect(risk.netVega).toBeCloseTo(60);
  });

  it('does not mark closed positions at stale marks', () => {
    const id = 'SPY:2026-07-17:500:call';
    let positions = recordTrade({}, {
      contract,
      direction: 'buy',
      quantity: 1,
      price: 2,
      timestamp: 't',
    });
    positions = recordTrade(positions, {
      contract,
      direction: 'sell',
      quantity: 1,
      price: 2.5,
      timestamp: 't2',
    });

    expect(markToMarket(positions, { [id]: 10 })).toBeCloseTo(50);
  });
});

describe('zonedTimeToUtcIso', () => {
  it('converts New York market open to UTC', () => {
    const iso = zonedTimeToUtcIso('2026-06-14', '09:30', 'America/New_York');
    expect(iso).toMatch(/T13:30:00/);
  });
});
