import { useMemo } from 'react';
import type { Layout } from 'plotly.js';

import { Plot } from '../lib/plotly';
import type { ViewportState } from '../domain/chartViewport';

interface TimeSeriesChartProps {
  title: string;
  times: number[];
  values: number[];
  viewport: ViewportState;
  yLabel: string;
  color?: string;
  onRelayout: (update: Record<string, unknown>) => void;
  onReset: () => void;
}

export function TimeSeriesChart({
  title,
  times,
  values,
  viewport,
  yLabel,
  color = '#3b82f6',
  onRelayout,
  onReset,
}: TimeSeriesChartProps) {
  const layout = useMemo<Partial<Layout>>(
    () => ({
      title: { text: title, font: { color: '#cbd5e1', size: 14 } },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#0f172a',
      font: { color: '#94a3b8', family: 'IBM Plex Mono, monospace', size: 11 },
      margin: { l: 56, r: 16, t: 36, b: 40 },
      xaxis: {
        title: { text: 'Time since start (s)' },
        gridcolor: '#1e293b',
        zerolinecolor: '#334155',
        range: viewport.xRange ?? undefined,
        fixedrange: false,
      },
      yaxis: {
        title: { text: yLabel },
        gridcolor: '#1e293b',
        zerolinecolor: '#334155',
        range: viewport.yRange ?? undefined,
        fixedrange: true,
      },
      hovermode: 'x unified',
      showlegend: false,
      dragmode: 'pan',
    }),
    [title, yLabel, viewport.xRange, viewport.yRange],
  );

  const data = useMemo(
    () => [
      {
        x: times,
        y: values,
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color, width: 2 },
        hovertemplate: `${yLabel}: %{y:.2f}<br>Time: %{x:.1f}s<extra></extra>`,
      },
    ],
    [times, values, yLabel, color],
  );

  if (times.length === 0) {
    return (
      <div className="chart-empty">
        <p>No data yet. Start the simulation to populate the chart.</p>
      </div>
    );
  }

  return (
    <div className="chart-panel">
      <div className="chart-toolbar">
        <span className="chart-meta">{times.length} samples</span>
        <button type="button" className="btn-ghost btn-sm" onClick={onReset}>
          Reset viewport
        </button>
      </div>
      <Plot
        data={data}
        layout={layout}
        config={{
          displayModeBar: true,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
          scrollZoom: true,
          responsive: true,
        }}
        style={{ width: '100%', height: 280 }}
        useResizeHandler
        onRelayout={onRelayout}
      />
    </div>
  );
}
