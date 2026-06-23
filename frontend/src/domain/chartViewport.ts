/** Chart viewport helpers — x-axis time window and y-axis rounding. */

export const GROWTH_PHASE_MAX_TIME = 1000;
export const SLIDING_WINDOW_WIDTH = 100;
export const HALF_GROWTH_PHASE_MAX_TIME = GROWTH_PHASE_MAX_TIME / 2;
export const HALF_SLIDING_WINDOW_WIDTH = SLIDING_WINDOW_WIDTH / 2;
export const LIVE_EDGE_TOLERANCE = 1.0;

export interface ViewportTimeConfig {
  growthMax?: number;
  windowWidth?: number;
}

export function roundAxisRange(min: number, max: number, step = 1): [number, number] {
  if (min === max) {
    const padded = step;
    return [Math.floor((min - padded) / step) * step, Math.ceil((max + padded) / step) * step];
  }
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

function followLatestTime(
  latestTime: number,
  windowWidth: number,
  growthMax: number,
): [number, number] {
  if (latestTime <= growthMax) {
    return [0, Math.max(latestTime, 1)];
  }
  return [latestTime - windowWidth, latestTime];
}

export function resolveXRange(
  currentRange: [number, number] | null,
  latestTime: number,
  userPanned: boolean,
  windowWidth = SLIDING_WINDOW_WIDTH,
  growthMax = GROWTH_PHASE_MAX_TIME,
): [number, number] {
  if (currentRange === null || !userPanned) {
    return followLatestTime(latestTime, windowWidth, growthMax);
  }

  const [currentStart, currentEnd] = currentRange;
  if (!isAtLiveEdge(currentEnd, latestTime)) {
    return [currentStart, currentEnd];
  }

  return followLatestTime(latestTime, windowWidth, growthMax);
}

export function isAtLiveEdge(xMax: number, latestTime: number): boolean {
  return latestTime - xMax <= LIVE_EDGE_TOLERANCE;
}

export function computeYRange(values: number[], step = 1): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  return roundAxisRange(min, max, step);
}

export interface ViewportState {
  xRange: [number, number] | null;
  yRange: [number, number] | null;
  userPanned: boolean;
}

export function nextViewport(
  state: ViewportState,
  latestTime: number,
  values: number[],
  yStep = 1,
  timeConfig: ViewportTimeConfig = {},
): ViewportState {
  const windowWidth = timeConfig.windowWidth ?? SLIDING_WINDOW_WIDTH;
  const growthMax = timeConfig.growthMax ?? GROWTH_PHASE_MAX_TIME;
  const xRange = resolveXRange(state.xRange, latestTime, state.userPanned, windowWidth, growthMax);
  const atLiveEdge = isAtLiveEdge(xRange[1], latestTime);

  return {
    xRange,
    yRange: computeYRange(values, yStep),
    userPanned: state.userPanned && !atLiveEdge,
  };
}

export function onChartRelayout(
  state: ViewportState,
  update: Record<string, unknown>,
  latestTime: number,
): ViewportState {
  const x0 = update['xaxis.range[0]'] as number | undefined;
  const x1 = update['xaxis.range[1]'] as number | undefined;

  if (x0 !== undefined && x1 !== undefined) {
    const atLiveEdge = isAtLiveEdge(x1, latestTime);
    return {
      ...state,
      xRange: [x0, x1],
      userPanned: !atLiveEdge,
    };
  }

  if (update['xaxis.autorange'] === true) {
    return {
      xRange: null,
      yRange: state.yRange,
      userPanned: false,
    };
  }

  return state;
}
