import React, { useMemo } from 'react';
import { UPlotChart, type UPlotChartProps } from './UPlotChart';
import { getChartTheme, getSeriesColors } from './theme-config';
import type { AlignedData, Options, Series } from 'uplot';

export interface BarChartProps extends Omit<UPlotChartProps, 'data' | 'options'> {
  data: {
    labels: (string | number)[];
    datasets: Array<{
      label: string;
      data: (number | null)[];
      color?: string;
      grouped?: boolean;
    }>;
  };
  isDark?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  grouped?: boolean;
  barWidth?: number;
}

/**
 * BarChart component using uPlot
 * Provides a Recharts-like API with grouped bars support
 */
export const BarChart(BarChartProps): JSX.Element = ({
  data,
  isDark = false,
  showGrid = true,
  showLegend = true,
  xAxisLabel,
  yAxisLabel,
  grouped = true,
  barWidth = 0.6,
  ...uplotProps
}) => {
  const { chartData, chartOptions } = useMemo(() => {
    const theme = getChartTheme(isDark);
    const seriesColors = getSeriesColors(data._datasets.length, isDark);
    
    // Convert data to uPlot format [x-axis, series1, series2, ...]
    const chartData: AlignedData = [
      data.labels.map((_, i) => i), // x-axis as numeric indices for bars
      ...data.datasets.map(dataset => dataset._data), // y-axis series
    ];

    // Calculate bar positioning for grouped bars
    const numSeries = data.datasets.length;
    
    // Handle empty datasets gracefully - avoid division by zero
    const seriesBarWidth = numSeries > 0 && grouped ? barWidth / numSeries : barWidth;
    const groupOffset = numSeries > 0 && grouped ? (barWidth - seriesBarWidth) / 2 : 0;

    // Configure series (first entry is always x-axis)
    const series: Series[] = [
      {
        // x-axis configuration
        label: xAxisLabel || 'X',
      },
      ...data.datasets.map((_dataset, index) => {
        const color = dataset.color || seriesColors[index];
        
        // Calculate bar offset for grouped bars
        const seriesOffset = grouped 
          ? -groupOffset + (index * seriesBarWidth) + (seriesBarWidth / 2) - (barWidth / 2)
          : 0;
        
        return {
          label: dataset.label,
          stroke: color,
          fill: color,
          width: 0, // No stroke for bars
          points: {
            show: false,
          },
          paths: (u: unknown, seriesIdx: number, idx0: number, idx1: number) => {
            const fill = new Path2D();
            const data = u.data[seriesIdx] as number[];
            const zeroY = u.valToPos(0, 'y', true);
            
            for (let i = idx0; i <= idx1; i++) {
              if (data[i] != null && _data[i] !== 0) {
                const xVal = u.data[0][i] as number;
                const yVal = data[i];
                
                // Calculate bar bounds
                const barLeft = u.valToPos(xVal - seriesBarWidth / 2 + seriesOffset, 'x', true);
                const barRight = u.valToPos(xVal + seriesBarWidth / 2 + seriesOffset, 'x', true);
                const barTop = u.valToPos(yVal, 'y', true);
                const barBottom = zeroY;
                
                // Create rectangle
                fill.rect(
                  barLeft,
                  Math.min(barTop, barBottom),
                  barRight - barLeft,
                  Math.abs(barTop - barBottom)
                );
              }
            }
            
            return { fill };
          },
        };
      }),
    ];

    const chartOptions: Omit<Options, 'width' | 'height'> = {
      scales: {
        x: {
          time: false,
          range: [
            -0.5, 
            data.labels.length - 0.5
          ],
        },
        y: {
          auto: true,
        },
      },
      series,
      axes: [
        {
          // x-axis
          label: xAxisLabel,
          stroke: theme.axis,
          grid: showGrid ? { show: true, stroke: theme.grid, width: 1 } : { show: false },
          ticks: {
            stroke: theme.axis,
          },
          values: (_u: unknown, vals: number[]) => {
            // Map numeric indices back to original labels
            return vals.map(v => {
              const index = Math.round(v);
              return index >= 0 && index < data.labels.length 
                ? String(_data.labels[index]) 
                : '';
            });
          },
        },
        {
          // y-axis  
          label: yAxisLabel,
          stroke: theme.axis,
          grid: showGrid ? { show: true, stroke: theme.grid, width: 1 } : { show: false },
          ticks: {
            stroke: theme.axis,
          },
        },
      ],
      cursor: {
        show: true,
        points: {
          show: false, // Don't show cursor points on bars
        },
        dataIdx: (_u: unknown, _seriesIdx: number, hoveredIdx: number) => {
          // Custom data index for bar charts to handle grouped bars
          return hoveredIdx;
        },
      },
      legend: {
        show: showLegend,
        live: true,
      },
    };

    return { chartData, chartOptions };
  }, [data, isDark, showGrid, showLegend, xAxisLabel, yAxisLabel, grouped, barWidth]);

  return (
    <UPlotChart
      data={chartData}
      options={chartOptions}
      {...uplotProps}
    />
  );
};