import { DeltaGridLogo } from './DeltaGridLogo';
import { useSimulationStore } from '../store/simulationStore';

const TIMEZONES = ['America/New_York', 'America/Chicago', 'UTC'];

export function Sidebar() {
  const ticker = useSimulationStore((s) => s.ticker);
  const expiry = useSimulationStore((s) => s.expiry);
  const mode = useSimulationStore((s) => s.mode);
  const replayDate = useSimulationStore((s) => s.replayDate);
  const replayStartTime = useSimulationStore((s) => s.replayStartTime);
  const replayTimezone = useSimulationStore((s) => s.replayTimezone);
  const replaySpeed = useSimulationStore((s) => s.replaySpeed);
  const running = useSimulationStore((s) => s.running);
  const simStartTime = useSimulationStore((s) => s.simStartTime);
  const liveRefreshSeconds = useSimulationStore((s) => s.liveRefreshSeconds);

  const setTicker = useSimulationStore((s) => s.setTicker);
  const setExpiry = useSimulationStore((s) => s.setExpiry);
  const setMode = useSimulationStore((s) => s.setMode);
  const setReplayDate = useSimulationStore((s) => s.setReplayDate);
  const setReplayStartTime = useSimulationStore((s) => s.setReplayStartTime);
  const setReplayTimezone = useSimulationStore((s) => s.setReplayTimezone);
  const setReplaySpeed = useSimulationStore((s) => s.setReplaySpeed);
  const toggleRunning = useSimulationStore((s) => s.toggleRunning);
  const startReplay = useSimulationStore((s) => s.startReplay);
  const resumeReplay = useSimulationStore((s) => s.resumeReplay);
  const pause = useSimulationStore((s) => s.pause);

  const replayActive = simStartTime !== null;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <DeltaGridLogo className="brand-logo" />
        <div>
          <h1>DeltaGrid</h1>
          <p>Options market making simulator</p>
        </div>
      </div>

      <section className="sidebar-section">
        <h2>Instrument</h2>
        <label className="field">
          <span>Ticker</span>
          <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="SPY" />
        </label>
        <label className="field">
          <span>Expiry</span>
          <input
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            placeholder="2026-07-17"
          />
          <small>YYYY-MM-DD format</small>
        </label>
      </section>

      <section className="sidebar-section">
        <h2>Simulation time</h2>
        <div className="segmented">
          <button
            type="button"
            className={mode === 'live' ? 'active' : ''}
            onClick={() => setMode('live')}
          >
            Live
          </button>
          <button
            type="button"
            className={mode === 'replay' ? 'active' : ''}
            onClick={() => setMode('replay')}
          >
            Replay
          </button>
        </div>

        {mode === 'live' ? (
          <>
            <p className="helper-text">Polls market data every {liveRefreshSeconds}s while running.</p>
            <div className="replay-controls">
              <button type="button" className="btn-primary" onClick={toggleRunning}>
                {running ? 'Pause live' : 'Start live'}
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="field">
              <span>Replay date</span>
              <input
                type="date"
                value={replayDate}
                onChange={(e) => setReplayDate(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Start time</span>
              <input
                type="time"
                value={replayStartTime}
                onChange={(e) => setReplayStartTime(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Timezone</span>
              <select
                value={replayTimezone}
                onChange={(e) => setReplayTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field-last">
              <span>Replay speed</span>
              <input
                type="number"
                min={1}
                step={1}
                value={replaySpeed}
                onChange={(e) => setReplaySpeed(Number(e.target.value))}
              />
              <small>Wall-clock multiplier</small>
            </label>
            <div className="replay-controls">
              <div className="btn-row">
                <button type="button" className="btn-primary" onClick={startReplay}>
                  Start replay
                </button>
                {running ? (
                  <button type="button" className="btn-secondary" onClick={pause}>
                    Pause
                  </button>
                ) : replayActive ? (
                  <button type="button" className="btn-secondary" onClick={resumeReplay}>
                    Resume
                  </button>
                ) : (
                  <button type="button" className="btn-secondary" disabled>
                    Pause
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </aside>
  );
}
