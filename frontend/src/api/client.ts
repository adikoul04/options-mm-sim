export const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface SpotResponse {
  ticker: string;
  spot: number;
}

export interface RfrResponse {
  rate: number;
}

export interface ChainRow {
  contractSymbol: string;
  option_type: 'call' | 'put';
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

export interface ChainResponse {
  ticker: string;
  expiry: string;
  spot: number;
  rfr: number;
  as_of: string;
  synthetic_market: boolean;
  rows: ChainRow[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(parseApiError(detail, response.status));
  }
  return response.json() as Promise<T>;
}

function parseApiError(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { detail?: unknown };
    if (typeof parsed.detail === 'string') {
      return parsed.detail;
    }
  } catch {
    // Fall through to raw body.
  }
  return body || `Request failed: ${status}`;
}

export async function getHealth(): Promise<{ status: string }> {
  return fetchJson('/health');
}

export async function getSpot(ticker: string): Promise<SpotResponse> {
  return fetchJson(`/spot?ticker=${encodeURIComponent(ticker)}`);
}

export async function getReplaySpot(ticker: string, timestamp: string): Promise<SpotResponse> {
  return fetchJson(
    `/replay/spot?ticker=${encodeURIComponent(ticker)}&timestamp=${encodeURIComponent(timestamp)}`,
  );
}

export async function getRfr(): Promise<RfrResponse> {
  return fetchJson('/rfr');
}

export async function getChain(params: {
  ticker: string;
  expiry: string;
  spot?: number;
  asOf?: string;
  synthetic?: boolean;
}): Promise<ChainResponse> {
  const search = new URLSearchParams({
    ticker: params.ticker,
    expiry: params.expiry,
  });
  if (params.spot !== undefined) search.set('spot', String(params.spot));
  if (params.asOf) search.set('as_of', params.asOf);
  if (params.synthetic) search.set('synthetic', 'true');
  return fetchJson(`/chain?${search.toString()}`);
}

export async function clearCache(): Promise<void> {
  await fetch(`${API_BASE}/cache/clear`, { method: 'POST' });
}
