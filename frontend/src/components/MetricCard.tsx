interface MetricCardProps {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}

export function MetricCard({ label, value, tone = 'neutral' }: MetricCardProps) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}
