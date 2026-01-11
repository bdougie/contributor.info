// Mock @nivo/scatterplot to avoid ES module issues in tests
import { vi } from 'vitest';
import { createElement } from 'react';

interface MockDataPoint {
  [key: string]: unknown;
}

interface MockSeries {
  id: string;
  data?: MockDataPoint[];
}

interface ScatterPlotProps {
  nodeComponent?: React.ComponentType<{
    node: { data: MockDataPoint; x: number; y: number };
    style: { x: { to: () => number }; y: { to: () => number }; size: { to: () => number } };
  }>;
  data?: MockSeries[];
  [key: string]: unknown;
}

export const ResponsiveScatterPlot = vi.fn(
  ({ nodeComponent, data = [] as MockSeries[], ...props }: ScatterPlotProps) => {
    // Simulate rendering nodes if nodeComponent is provided
    const nodes = data.flatMap(
      (series: MockSeries, seriesIndex: number) =>
        series.data
          ?.map((point: MockDataPoint, pointIndex: number) => {
            if (nodeComponent) {
              return createElement(nodeComponent, {
                key: `${series.id}-${pointIndex}`,
                node: {
                  data: point,
                  x: 50 + pointIndex * 10,
                  y: 50 + seriesIndex * 10,
                },
                style: {
                  x: { to: () => 50 + pointIndex * 10 },
                  y: { to: () => 50 + seriesIndex * 10 },
                  size: { to: () => 10 },
                },
              });
            }
            return null;
          })
          .filter(Boolean) || []
    );

    return createElement(
      'div',
      {
        'data-testid': 'mock-responsive-scatterplot',
        'data-points': data.reduce(
          (acc: number, series: MockSeries) => acc + (series.data?.length || 0),
          0
        ),
        style: { width: '100%', height: '100%' },
        ...props,
      },
      nodes
    );
  }
);

export const ScatterPlot = vi.fn(
  ({ nodeComponent, data = [] as MockSeries[], ...props }: ScatterPlotProps) => {
    // Similar implementation as ResponsiveScatterPlot
    const nodes = data.flatMap(
      (series: MockSeries, seriesIndex: number) =>
        series.data
          ?.map((point: MockDataPoint, pointIndex: number) => {
            if (nodeComponent) {
              return createElement(nodeComponent, {
                key: `${series.id}-${pointIndex}`,
                node: {
                  data: point,
                  x: 50 + pointIndex * 10,
                  y: 50 + seriesIndex * 10,
                },
                style: {
                  x: { to: () => 50 + pointIndex * 10 },
                  y: { to: () => 50 + seriesIndex * 10 },
                  size: { to: () => 10 },
                },
              });
            }
            return null;
          })
          .filter(Boolean) || []
    );

    return createElement(
      'div',
      {
        'data-testid': 'mock-scatterplot',
        'data-points': data.reduce(
          (acc: number, series: MockSeries) => acc + (series.data?.length || 0),
          0
        ),
        style: { width: '100%', height: '100%' },
        ...props,
      },
      nodes
    );
  }
);

export default ResponsiveScatterPlot;
