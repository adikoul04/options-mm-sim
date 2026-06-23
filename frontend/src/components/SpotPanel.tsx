import { MetricCard } from './MetricCard';
import { useSimulationStore } from '../store/simulationStore';

export function SpotPanel() {
  const spot = useSimulationStore((s) => s.spot);

  return (
    <section className="spot-panel">
      <MetricCard label="Spot" value={spot !== null ? spot.toFixed(2) : '—'} />
    </section>
  );
}
