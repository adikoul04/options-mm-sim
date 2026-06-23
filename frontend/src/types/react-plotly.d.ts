declare module 'plotly.js/dist/plotly' {
  const Plotly: unknown;
  export default Plotly;
}

declare module 'react-plotly.js/factory' {
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

  export default function createPlotlyComponent(
    plotly: unknown,
  ): ComponentType<PlotParams>;
}
