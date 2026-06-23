import type { ComponentType } from 'react';
import type { Config, Data, Layout } from 'plotly.js';

interface PlotParams {
  data: Data[];
  layout?: Partial<Layout>;
  config?: Partial<Config>;
  style?: React.CSSProperties;
  className?: string;
  useResizeHandler?: boolean;
  onRelayout?: (event: Record<string, unknown>) => void;
}

type PlotlyFactory = (plotly: unknown) => ComponentType<PlotParams>;

function resolveDefault<T>(module: T): T {
  let current: unknown = module;
  while (current && typeof current === 'object' && 'default' in current) {
    const next = (current as { default: unknown }).default;
    if (!next || next === current) break;
    current = next;
  }
  return current as T;
}

import createPlotlyComponentImport from 'react-plotly.js/factory';
import PlotlyImport from 'plotly.js/dist/plotly';

const createPlotlyComponent = resolveDefault<PlotlyFactory>(
  createPlotlyComponentImport as unknown as PlotlyFactory,
);
const Plotly = resolveDefault(PlotlyImport);

export const Plot = createPlotlyComponent(Plotly);
