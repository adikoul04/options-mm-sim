import { DataTable } from '../components/DataTable';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { useSimulationStore } from '../store/simulationStore';

export function ChainTab() {
  const chain = useSimulationStore((s) => s.chain);
  const history = useSimulationStore((s) => s.history);
  const spotViewport = useSimulationStore((s) => s.spotViewport);
  const onSpotRelayout = useSimulationStore((s) => s.onSpotRelayout);
  const resetSpotViewport = useSimulationStore((s) => s.resetSpotViewport);
  const expiry = useSimulationStore((s) => s.expiry);

  if (!expiry) {
    return (
      <div className="empty-panel">
        <h3>Enter an expiry date</h3>
        <p>Set an expiration in the sidebar (e.g. 2026-07-17) to load the option chain.</p>
      </div>
    );
  }

  const times = history.map((h) => h.timeSinceStart);
  const spots = history.map((h) => h.spot);

  const chainRows = chain.map((row) => ({
    contractSymbol: row.contractSymbol,
    option_type: row.option_type,
    strike: row.strike,
    bid: row.bid,
    ask: row.ask,
    mid: row.mid,
    iv: row.iv,
    fair_value: row.fair_value,
    delta: row.delta,
    gamma: row.gamma,
    theta: row.theta,
    vega: row.vega,
  }));

  return (
    <div className="tab-panel">
      <TimeSeriesChart
        title="Spot price"
        times={times}
        values={spots}
        viewport={spotViewport}
        yLabel="Spot"
        color="#38bdf8"
        onRelayout={onSpotRelayout}
        onReset={resetSpotViewport}
      />

      <section className="section-block">
        <div className="section-header">
          <h3>Option chain</h3>
          <span className="section-meta">{chain.length} contracts</span>
        </div>
        <DataTable
          columns={[
            { key: 'contractSymbol', label: 'Symbol' },
            { key: 'option_type', label: 'Type' },
            { key: 'strike', label: 'Strike', align: 'right' },
            { key: 'bid', label: 'Bid', align: 'right' },
            { key: 'ask', label: 'Ask', align: 'right' },
            { key: 'mid', label: 'Mid', align: 'right' },
            { key: 'iv', label: 'IV', align: 'right' },
            { key: 'fair_value', label: 'Fair', align: 'right' },
            { key: 'delta', label: 'Delta', align: 'right' },
            { key: 'gamma', label: 'Gamma', align: 'right' },
            { key: 'theta', label: 'Theta', align: 'right' },
            { key: 'vega', label: 'Vega', align: 'right' },
          ]}
          rows={chainRows}
          emptyMessage="Chain loading…"
        />
      </section>
    </div>
  );
}
