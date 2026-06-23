import { useEffect, useMemo, useState } from 'react';

import { DataTable } from '../components/DataTable';
import { DecimalInput, parseDecimalInput } from '../components/DecimalInput';
import { MetricCard } from '../components/MetricCard';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { type ChainRow, parseContractId, type SpreadScope, type SpreadShape } from '../domain/models';
import { makeCustomQuote, makeShapedQuote } from '../domain/quoteEngine';
import { useSimulationStore } from '../store/simulationStore';

const SPREAD_SHAPES: Array<{ id: SpreadShape; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'left_skewed', label: 'Left skewed' },
  { id: 'right_skewed', label: 'Right skewed' },
  { id: 'custom', label: 'Custom' },
];

function hasMarketData(row: ChainRow | undefined): boolean {
  if (!row) return false;
  return row.bid > 0 || row.ask > 0 || row.mid > 0;
}

function MarketLeg({ title, row }: { title: string; row: ChainRow | undefined }) {
  return (
    <div className="market-leg">
      <h4>{title}</h4>
      {hasMarketData(row) ? (
        <div className="market-leg-grid">
          <span>Mkt bid {row!.bid.toFixed(2)}</span>
          <span>Mkt ask {row!.ask.toFixed(2)}</span>
          <span>Fair {row!.fair_value.toFixed(2)}</span>
          <span>Mid {row!.mid.toFixed(2)}</span>
        </div>
      ) : (
        <p className="market-empty">No market data for this strike.</p>
      )}
    </div>
  );
}

export function QuotesTab() {
  const chain = useSimulationStore((s) => s.chain);
  const quotes = useSimulationStore((s) => s.quotes);
  const trades = useSimulationStore((s) => s.trades);
  const risk = useSimulationStore((s) => s.risk);
  const history = useSimulationStore((s) => s.history);
  const quoteSpread = useSimulationStore((s) => s.quoteSpread);
  const quoteQuantity = useSimulationStore((s) => s.quoteQuantity);
  const pnlViewport = useSimulationStore((s) => s.pnlViewport);
  const quantityViewport = useSimulationStore((s) => s.quantityViewport);
  const setQuoteSpread = useSimulationStore((s) => s.setQuoteSpread);
  const setQuoteQuantity = useSimulationStore((s) => s.setQuoteQuantity);
  const sendSpread = useSimulationStore((s) => s.sendSpread);
  const removeQuote = useSimulationStore((s) => s.removeQuote);
  const onPnlRelayout = useSimulationStore((s) => s.onPnlRelayout);
  const resetPnlViewport = useSimulationStore((s) => s.resetPnlViewport);
  const expiry = useSimulationStore((s) => s.expiry);

  const strikes = useMemo(
    () => [...new Set(chain.map((r) => r.strike))].sort((a, b) => a - b),
    [chain],
  );

  const [selectedStrike, setSelectedStrike] = useState<number | ''>('');
  const [spreadScope, setSpreadScope] = useState<SpreadScope>('both');
  const [spreadShape, setSpreadShape] = useState<SpreadShape>('balanced');
  const [spreadText, setSpreadText] = useState('0.05');
  const [callBidText, setCallBidText] = useState('');
  const [callAskText, setCallAskText] = useState('');
  const [putBidText, setPutBidText] = useState('');
  const [putAskText, setPutAskText] = useState('');
  const [quantityText, setQuantityText] = useState('1');

  useEffect(() => {
    setSpreadText(String(quoteSpread));
  }, [quoteSpread]);

  useEffect(() => {
    setQuantityText(String(quoteQuantity));
  }, [quoteQuantity]);

  const strike = Number(selectedStrike || strikes[0] || 0);
  const callRow = chain.find((r) => r.strike === strike && r.option_type === 'call');
  const putRow = chain.find((r) => r.strike === strike && r.option_type === 'put');
  const spreadWidth = parseDecimalInput(spreadText, quoteSpread);

  const previewForRow = (row: typeof callRow, customBid?: number, customAsk?: number) => {
    if (!row) return null;
    if (spreadShape === 'custom') {
      return makeCustomQuote(customBid ?? 0, customAsk ?? 0, row.fair_value);
    }
    if (spreadWidth <= 0) return null;
    return makeShapedQuote(row.fair_value, spreadWidth, spreadShape, row.iv, {
      baseSpread: spreadWidth,
    });
  };

  const callPreview = previewForRow(
    callRow,
    parseDecimalInput(callBidText),
    parseDecimalInput(callAskText),
  );
  const putPreview = previewForRow(
    putRow,
    parseDecimalInput(putBidText),
    parseDecimalInput(putAskText),
  );

  const times = history.map((h) => h.timeSinceStart);
  const pnls = history.map((h) => h.pnl);
  const quantities = history.map((h) => h.quantity);

  const pnlTone =
    risk && risk.pnl > 0 ? 'positive' : risk && risk.pnl < 0 ? 'negative' : 'neutral';

  const positionRows = risk
    ? Object.entries(risk.positions).map(([id, qty]) => {
        const contract = parseContractId(id);
        return {
          ticker: contract.ticker,
          strike: contract.strike,
          option_type: contract.option_type,
          expiry: contract.expiry,
          quantity: qty,
        };
      })
    : [];

  const totalContracts = positionRows.reduce((sum, r) => sum + Math.abs(r.quantity as number), 0);

  const activeQuoteRows = Object.entries(quotes).map(([id, quote]) => {
    const contract = parseContractId(id);
    return {
      id,
      strike: contract.strike,
      option_type: contract.option_type,
      bid: quote.bid,
      ask: quote.ask,
      fair_value: quote.fair_value,
      spreadShape: quote.spreadShape ?? '—',
    };
  });

  const tradeRows = trades.map((t) => ({
    timestamp: new Date(t.timestamp).toLocaleString(),
    strike: t.contract.strike,
    option_type: t.contract.option_type,
    direction: t.direction,
    quantity: t.quantity,
    price: t.price,
  }));

  const handleSendQuote = () => {
    const width = parseDecimalInput(spreadText, quoteSpread);
    const qty = Math.max(1, Math.floor(parseDecimalInput(quantityText, quoteQuantity)));
    if (spreadShape !== 'custom' && width <= 0) return;

    if (spreadShape !== 'custom') {
      setQuoteSpread(width);
    }
    setQuoteQuantity(qty);

    sendSpread(
      strike,
      spreadScope,
      spreadShape,
      width,
      spreadShape === 'custom'
        ? {
            callBid: parseDecimalInput(callBidText),
            callAsk: parseDecimalInput(callAskText),
            putBid: parseDecimalInput(putBidText),
            putAsk: parseDecimalInput(putAskText),
          }
        : undefined,
    );
  };

  if (!expiry) {
    return (
      <div className="empty-panel">
        <h3>Quotes unavailable</h3>
        <p>Load an option chain first by entering an expiry date.</p>
      </div>
    );
  }

  return (
    <div className="tab-panel">
      <section className="section-block">
        <div className="section-header">
          <h3>Portfolio</h3>
        </div>
        <div className="metric-row five">
          <MetricCard
            label="P&L"
            value={risk ? risk.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
            tone={pnlTone}
          />
          <MetricCard label="Delta" value={risk ? risk.netDelta.toFixed(2) : '—'} />
          <MetricCard label="Gamma" value={risk ? risk.netGamma.toFixed(4) : '—'} />
          <MetricCard label="Theta" value={risk ? risk.netTheta.toFixed(4) : '—'} />
          <MetricCard label="Vega" value={risk ? risk.netVega.toFixed(4) : '—'} />
        </div>
        <DataTable
          columns={[
            { key: 'ticker', label: 'Ticker' },
            { key: 'option_type', label: 'Type' },
            { key: 'strike', label: 'Strike', align: 'right' },
            { key: 'expiry', label: 'Expiry' },
            { key: 'quantity', label: 'Qty', align: 'right' },
          ]}
          rows={positionRows}
          emptyMessage="No open positions"
        />
        <span className="section-meta inline-meta">
          {positionRows.length} lines · {totalContracts} contracts
        </span>
      </section>

      <div className="chart-row two">
        <TimeSeriesChart
          title="P&L"
          times={times}
          values={pnls}
          viewport={pnlViewport}
          yLabel="P&L"
          color="#34d399"
          onRelayout={onPnlRelayout}
          onReset={resetPnlViewport}
        />

        <TimeSeriesChart
          title="Position quantity"
          times={times}
          values={quantities}
          viewport={quantityViewport}
          yLabel="Contracts"
          color="#a78bfa"
          onRelayout={onPnlRelayout}
          onReset={resetPnlViewport}
        />
      </div>

      <section className="section-block">
        <div className="section-header">
          <h3>Send quotes</h3>
          <span className="section-meta">Strike-based spread quoting</span>
        </div>

        {strikes.length === 0 ? (
          <p className="helper-text">Waiting for chain data…</p>
        ) : (
          <>
            <div className="form-grid three">
              <label className="field">
                <span>Strike</span>
                <select
                  value={selectedStrike || strikes[0] || ''}
                  onChange={(e) => setSelectedStrike(Number(e.target.value))}
                >
                  {strikes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Legs</span>
                <select
                  value={spreadScope}
                  onChange={(e) => setSpreadScope(e.target.value as SpreadScope)}
                >
                  <option value="both">Call + Put</option>
                  <option value="call">Call only</option>
                  <option value="put">Put only</option>
                </select>
              </label>
              <label className="field">
                <span>Quantity</span>
                <DecimalInput value={quantityText} onChange={setQuantityText} placeholder="1" />
              </label>
            </div>

            <div className="market-values">
              {(spreadScope === 'both' || spreadScope === 'call') && (
                <MarketLeg title={`Call ${strike}`} row={callRow} />
              )}
              {(spreadScope === 'both' || spreadScope === 'put') && (
                <MarketLeg title={`Put ${strike}`} row={putRow} />
              )}
            </div>

            <div className="spread-shape-row">
              {SPREAD_SHAPES.map((shape) => (
                <button
                  key={shape.id}
                  type="button"
                  className={`spread-shape-btn ${spreadShape === shape.id ? 'active' : ''}`}
                  onClick={() => setSpreadShape(shape.id)}
                >
                  {shape.label}
                </button>
              ))}
            </div>

            {spreadShape !== 'custom' ? (
              <div className="form-grid two">
                <label className="field">
                  <span>Spread width</span>
                  <DecimalInput value={spreadText} onChange={setSpreadText} placeholder="0.05" />
                </label>
                <div className="quote-preview-panel">
                  {(spreadScope === 'both' || spreadScope === 'call') &&
                    (callPreview ? (
                      <div>
                        <strong>Call quote</strong> · Bid {callPreview.bid.toFixed(2)} · Ask{' '}
                        {callPreview.ask.toFixed(2)}
                      </div>
                    ) : (
                      <div className="helper-text">Enter a spread width to preview the call quote.</div>
                    ))}
                  {(spreadScope === 'both' || spreadScope === 'put') &&
                    (putPreview ? (
                      <div>
                        <strong>Put quote</strong> · Bid {putPreview.bid.toFixed(2)} · Ask{' '}
                        {putPreview.ask.toFixed(2)}
                      </div>
                    ) : (
                      <div className="helper-text">Enter a spread width to preview the put quote.</div>
                    ))}
                  <small className="helper-text">Updates automatically as fair value moves.</small>
                </div>
              </div>
            ) : (
              <div className="form-grid four">
                {(spreadScope === 'both' || spreadScope === 'call') && (
                  <>
                    <label className="field">
                      <span>Call bid</span>
                      <DecimalInput
                        value={callBidText}
                        onChange={setCallBidText}
                        placeholder="0.00"
                      />
                    </label>
                    <label className="field">
                      <span>Call ask</span>
                      <DecimalInput
                        value={callAskText}
                        onChange={setCallAskText}
                        placeholder="0.00"
                      />
                    </label>
                  </>
                )}
                {(spreadScope === 'both' || spreadScope === 'put') && (
                  <>
                    <label className="field">
                      <span>Put bid</span>
                      <DecimalInput
                        value={putBidText}
                        onChange={setPutBidText}
                        placeholder="0.00"
                      />
                    </label>
                    <label className="field">
                      <span>Put ask</span>
                      <DecimalInput
                        value={putAskText}
                        onChange={setPutAskText}
                        placeholder="0.00"
                      />
                    </label>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn-primary send-quote-btn"
              disabled={!strikes.length}
              onClick={handleSendQuote}
            >
              Send quote
            </button>
          </>
        )}
      </section>

      <section className="section-block">
        <div className="section-header">
          <h3>Active quotes</h3>
          <span className="section-meta">{activeQuoteRows.length} live</span>
        </div>
        <DataTable
          columns={[
            { key: 'strike', label: 'Strike', align: 'right' },
            { key: 'option_type', label: 'Type' },
            { key: 'bid', label: 'Bid', align: 'right' },
            { key: 'ask', label: 'Ask', align: 'right' },
            { key: 'fair_value', label: 'Fair', align: 'right' },
            { key: 'spreadShape', label: 'Shape' },
          ]}
          rows={activeQuoteRows}
          emptyMessage="No active quotes"
        />
        {activeQuoteRows.length > 0 && (
          <div className="quote-actions">
            {activeQuoteRows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => removeQuote(row.id)}
              >
                Cancel {row.option_type} {row.strike}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-header">
          <h3>Trade log</h3>
          <span className="section-meta">{tradeRows.length} fills</span>
        </div>
        <DataTable
          columns={[
            { key: 'timestamp', label: 'Time' },
            { key: 'option_type', label: 'Type' },
            { key: 'strike', label: 'Strike', align: 'right' },
            { key: 'direction', label: 'Side' },
            { key: 'quantity', label: 'Qty', align: 'right' },
            { key: 'price', label: 'Price', align: 'right' },
          ]}
          rows={tradeRows}
          emptyMessage="No trades yet"
        />
      </section>
    </div>
  );
}
