import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { clearCache, getChain, getReplaySpot, getSpot } from '../api/client';
import { computeYRange, HALF_GROWTH_PHASE_MAX_TIME, HALF_SLIDING_WINDOW_WIDTH, nextViewport, onChartRelayout, type ViewportState } from '../domain/chartViewport';
import { DEFAULT_FILL_SIM_CONFIG, monitorQuotes, type FillSimConfig } from '../domain/fillSim';
import { buildRiskInputs, recordTrade, snapshot, type PositionsMap } from '../domain/position';
import { buildSpreadQuotes, refreshAutoQuotes } from '../domain/quoteRefresh';
import { zonedTimeToUtcIso } from '../domain/time';
import {
  chainRowToContract,
  type ChainRow,
  type OptionTypeFilter,
  type Quote,
  type RiskSnapshot,
  type SimMode,
  type SpreadScope,
  type SpreadShape,
  type Trade,
} from '../domain/models';

export type TabId = 'chain' | 'quotes';

interface HistoryPoint {
  timeSinceStart: number;
  spot: number;
  pnl: number;
  quantity: number;
}

interface SimulationState {
  // Settings
  ticker: string;
  expiry: string;
  mode: SimMode;
  replayDate: string;
  replayStartTime: string;
  replayTimezone: string;
  replaySpeed: number;
  liveRefreshSeconds: number;
  replayRefreshSeconds: number;

  // Clock
  running: boolean;
  simTime: string | null;
  simStartTime: string | null;
  replayLastWallTime: number | null;

  // Market data
  spot: number | null;
  chain: ChainRow[];
  rfr: number | null;
  loading: boolean;
  error: string | null;

  // Trading
  quotes: Record<string, Quote>;
  trades: Trade[];
  positions: PositionsMap;
  quoteSpread: number;
  quoteQuantity: number;
  optionTypeFilter: OptionTypeFilter;
  fillSimConfig: FillSimConfig;

  // Metrics
  risk: RiskSnapshot | null;
  history: HistoryPoint[];
  recentFills: Trade[];

  // UI
  activeTab: TabId;
  spotViewport: ViewportState;
  pnlViewport: ViewportState;
  quantityViewport: ViewportState;

  // Actions
  setTicker: (ticker: string) => void;
  setExpiry: (expiry: string) => void;
  setMode: (mode: SimMode) => void;
  setReplayDate: (date: string) => void;
  setReplayStartTime: (time: string) => void;
  setReplayTimezone: (tz: string) => void;
  setReplaySpeed: (speed: number) => void;
  setActiveTab: (tab: TabId) => void;
  setQuoteSpread: (spread: number) => void;
  setQuoteQuantity: (qty: number) => void;
  setOptionTypeFilter: (filter: OptionTypeFilter) => void;
  toggleRunning: () => void;
  startReplay: () => void;
  resumeReplay: () => void;
  pause: () => void;
  tick: () => Promise<void>;
  sendSpread: (
    strike: number,
    scope: SpreadScope,
    shape: SpreadShape,
    spreadWidth: number,
    custom?: {
      callBid?: number;
      callAsk?: number;
      putBid?: number;
      putAsk?: number;
    },
  ) => void;
  removeQuote: (id: string) => void;
  resetSpotViewport: () => void;
  resetPnlViewport: () => void;
  onSpotRelayout: (update: Record<string, unknown>) => void;
  onPnlRelayout: (update: Record<string, unknown>) => void;
  dismissFillAlert: (index: number) => void;
}

const DEFAULT_TICKER = 'SPY';
const DEFAULT_TIMEZONE = 'America/New_York';

function defaultReplayDate(): string {
  const date = new Date();
  // Yahoo minute bars lag a few trading days; default well into the past.
  date.setDate(date.getDate() - 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let tickInFlight = false;

function toUtcIsoFromLocal(date: string, time: string, timezone: string): string {
  return zonedTimeToUtcIso(date, time, timezone);
}

function getFilteredChain(chain: ChainRow[], filter: OptionTypeFilter): ChainRow[] {
  if (filter === 'call') return chain.filter((r) => r.option_type === 'call');
  if (filter === 'put') return chain.filter((r) => r.option_type === 'put');
  return chain;
}

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      ticker: DEFAULT_TICKER,
      expiry: '',
      mode: 'live',
      replayDate: defaultReplayDate(),
      replayStartTime: '09:30',
      replayTimezone: DEFAULT_TIMEZONE,
      replaySpeed: 1,
      liveRefreshSeconds: 5,
      replayRefreshSeconds: 1,

      running: false,
      simTime: null,
      simStartTime: null,
      replayLastWallTime: null,

      spot: null,
      chain: [],
      rfr: null,
      loading: false,
      error: null,

      quotes: {},
      trades: [],
      positions: {},
      quoteSpread: 0.05,
      quoteQuantity: 1,
      optionTypeFilter: 'both',
      fillSimConfig: DEFAULT_FILL_SIM_CONFIG,

      risk: null,
      history: [],
      recentFills: [],

      activeTab: 'chain',
      spotViewport: { xRange: null, yRange: null, userPanned: false },
      pnlViewport: { xRange: null, yRange: null, userPanned: false },
      quantityViewport: { xRange: null, yRange: null, userPanned: false },

      setTicker: (ticker) => set({ ticker: ticker.toUpperCase() }),
      setExpiry: (expiry) => set({ expiry }),
      setMode: (mode) => set({ mode, running: false }),
      setReplayDate: (replayDate) => set({ replayDate }),
      setReplayStartTime: (replayStartTime) => set({ replayStartTime }),
      setReplayTimezone: (replayTimezone) => set({ replayTimezone }),
      setReplaySpeed: (replaySpeed) => set({ replaySpeed }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setQuoteSpread: (quoteSpread) => set({ quoteSpread }),
      setQuoteQuantity: (quoteQuantity) => set({ quoteQuantity }),
      setOptionTypeFilter: (optionTypeFilter) => set({ optionTypeFilter }),

      toggleRunning: () => {
        const { running, mode } = get();
        if (!running && mode === 'live') {
          void clearCache();
        }
        set({ running: !running, replayLastWallTime: running ? null : Date.now() });
      },

      startReplay: () => {
        const { replayDate, replayStartTime, replayTimezone } = get();
        const simStart = toUtcIsoFromLocal(replayDate, replayStartTime, replayTimezone);
        set({
          running: true,
          simTime: simStart,
          simStartTime: simStart,
          replayLastWallTime: Date.now(),
          history: [],
          error: null,
        });
      },

      resumeReplay: () => {
        const { simStartTime } = get();
        if (!simStartTime) return;
        set({ running: true, replayLastWallTime: Date.now() });
      },

      pause: () => set({ running: false, replayLastWallTime: null }),

      tick: async () => {
        if (tickInFlight) return;

        const state = get();
        const { ticker, expiry, mode, running } = state;
        if (!expiry) {
          set({ error: 'Enter an expiry date to load the option chain.' });
          return;
        }

        tickInFlight = true;
        set({ loading: true, error: null });

        try {
          let simTime = state.simTime ?? new Date().toISOString();
          let simStartTime = state.simStartTime;

          if (mode === 'replay' && running && state.replayLastWallTime) {
            const now = Date.now();
            const elapsed = (now - state.replayLastWallTime) / 1000;
            const advanced = elapsed * state.replaySpeed;
            const current = new Date(simTime);
            current.setSeconds(current.getSeconds() + advanced);
            simTime = current.toISOString();
            set({ simTime, replayLastWallTime: now });
          } else if (mode === 'live') {
            simTime = new Date().toISOString();
            if (running) void clearCache();
          }

          if (!simStartTime) {
            simStartTime = simTime;
            set({ simStartTime: simStartTime });
          }

          const timeSinceStart =
            (new Date(simTime).getTime() - new Date(simStartTime).getTime()) / 1000;

          let spot: number;
          if (mode === 'live') {
            spot = (await getSpot(ticker)).spot;
          } else {
            spot = (await getReplaySpot(ticker, simTime)).spot;
          }

          const chainResponse = await getChain({
            ticker,
            expiry,
            spot,
            asOf: simTime,
            synthetic: mode === 'replay' || (mode === 'live' && running),
          });

          const chain = chainResponse.rows as ChainRow[];

          const refreshedQuotes = refreshAutoQuotes(state.quotes, chain);

          const monitorRows = chain.map((row) => ({
            contract: chainRowToContract(ticker, row),
            bid: row.bid,
            ask: row.ask,
          }));

          const tickSeconds =
            mode === 'live' ? state.liveRefreshSeconds : state.replayRefreshSeconds;

          const { fills, remainingQuotes } = monitorQuotes(
            refreshedQuotes,
            monitorRows,
            state.quoteQuantity,
            simTime,
            state.fillSimConfig,
            tickSeconds,
          );

          let positions = state.positions;
          for (const fill of fills) {
            positions = recordTrade(positions, fill);
          }

          const { marks, greeks } = buildRiskInputs(ticker, chain, positions);
          const risk = snapshot(positions, marks, greeks);
          const totalQty = Object.values(risk.positions).reduce((sum, q) => sum + Math.abs(q), 0);

          const history = [
            ...state.history,
            { timeSinceStart, spot, pnl: risk.pnl, quantity: totalQty },
          ];

          const spotValues = history.map((h) => h.spot);
          const pnlValues = history.map((h) => h.pnl);
          const quantityValues = history.map((h) => h.quantity);

          const spotViewport = nextViewport(state.spotViewport, timeSinceStart, spotValues);
          const narrowTime = {
            growthMax: HALF_GROWTH_PHASE_MAX_TIME,
            windowWidth: HALF_SLIDING_WINDOW_WIDTH,
          };
          const pnlViewport = nextViewport(
            state.pnlViewport,
            timeSinceStart,
            pnlValues,
            10,
            narrowTime,
          );
          const quantityViewport: ViewportState = {
            xRange: pnlViewport.xRange,
            yRange: computeYRange(quantityValues, 1),
            userPanned: pnlViewport.userPanned,
          };

          set({
            spot,
            chain,
            rfr: chainResponse.rfr,
            simTime,
            quotes: remainingQuotes,
            trades: fills.length ? [...state.trades, ...fills] : state.trades,
            positions,
            risk,
            history,
            recentFills: fills.length ? [...state.recentFills, ...fills] : state.recentFills,
            loading: false,
            spotViewport,
            pnlViewport,
            quantityViewport,
          });
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch market data',
          });
        } finally {
          tickInFlight = false;
        }
      },

      sendSpread: (strike, scope, shape, spreadWidth, custom) => {
        const { ticker, chain, quotes } = get();
        const newQuotes = buildSpreadQuotes(chain, ticker, strike, scope, shape, spreadWidth, custom);
        set({ quotes: { ...quotes, ...newQuotes } });
      },

      removeQuote: (id) => {
        const { quotes } = get();
        const next = { ...quotes };
        delete next[id];
        set({ quotes: next });
      },

      resetSpotViewport: () =>
        set({ spotViewport: { xRange: null, yRange: null, userPanned: false } }),
      resetPnlViewport: () =>
        set({
          pnlViewport: { xRange: null, yRange: null, userPanned: false },
          quantityViewport: { xRange: null, yRange: null, userPanned: false },
        }),

      onSpotRelayout: (update) => {
        const { spotViewport, history } = get();
        const latest = history.length ? history[history.length - 1].timeSinceStart : 0;
        set({ spotViewport: onChartRelayout(spotViewport, update, latest) });
      },

      onPnlRelayout: (update) => {
        const { pnlViewport, quantityViewport, history } = get();
        const latest = history.length ? history[history.length - 1].timeSinceStart : 0;
        const nextPnl = onChartRelayout(pnlViewport, update, latest);
        set({
          pnlViewport: nextPnl,
          quantityViewport: {
            ...quantityViewport,
            xRange: nextPnl.xRange,
            userPanned: nextPnl.userPanned,
          },
        });
      },

      dismissFillAlert: (index) => {
        const { recentFills } = get();
        set({ recentFills: recentFills.filter((_, i) => i !== index) });
      },
    }),
    {
      name: 'deltagrid-settings',
      partialize: (state) => ({
        ticker: state.ticker,
        expiry: state.expiry,
        mode: state.mode,
        replayDate: state.replayDate,
        replayStartTime: state.replayStartTime,
        replayTimezone: state.replayTimezone,
        replaySpeed: state.replaySpeed,
        quoteSpread: state.quoteSpread,
        quoteQuantity: state.quoteQuantity,
        optionTypeFilter: state.optionTypeFilter,
      }),
    },
  ),
);

export { getFilteredChain };
