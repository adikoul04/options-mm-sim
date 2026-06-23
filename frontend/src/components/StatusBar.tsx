import { useSimulationStore } from '../store/simulationStore';

export function StatusBar() {
  const mode = useSimulationStore((s) => s.mode);
  const running = useSimulationStore((s) => s.running);
  const simTime = useSimulationStore((s) => s.simTime);
  const loading = useSimulationStore((s) => s.loading);
  const error = useSimulationStore((s) => s.error);
  const recentFills = useSimulationStore((s) => s.recentFills);
  const dismissFillAlert = useSimulationStore((s) => s.dismissFillAlert);

  return (
    <header className="status-bar">
      <div className="status-left">
        <span className={`status-dot ${running ? 'live' : 'paused'}`} />
        <span className="status-mode">{mode === 'live' ? 'Live' : 'Replay'}</span>
        <span className="status-time">
          {simTime ? new Date(simTime).toLocaleString() : '—'}
        </span>
        <span className="status-running">{running ? 'Running' : 'Paused'}</span>
        {loading && <span className="status-loading">Updating…</span>}
      </div>
      {error && <div className="status-error">{error}</div>}
      {recentFills.length > 0 && (
        <div className="fill-alerts">
          {recentFills.slice(-3).map((fill, idx) => (
            <button
              key={`${fill.timestamp}-${idx}`}
              type="button"
              className="fill-alert"
              onClick={() => dismissFillAlert(idx)}
            >
              Filled {fill.direction} {fill.quantity} {fill.contract.option_type}{' '}
              {fill.contract.strike} @ {fill.price.toFixed(2)}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
