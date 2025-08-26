import React, { useMemo } from 'react';
import { UPlotChart, type UPlotChartProps } from './UPlotChart';
import { getChartTheme, getSeriesColors } from './theme-config';
import { colorWithAlpha, processLabelsForUPlot, createAxisValuesFormatter } from './chart-utils';
import type { AlignedData, Options, Series } from 'uplot';

export interface AreaChartProps extends Omit<UPlotChartProps, 'data' | 'options'> {
  data: {
    labels: (string | number)[];
    datasets: Array<{
      label: string;
      data: (number | null)[];
      color?: string;
      strokeWidth?: number;
      fillOpacity?: number;
      stacked?: boolean;
    }>;
  };
  isDark?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  stacked?: boolean;
}

/**
 * AreaChart component using uPlot
 * Provides a Recharts-like API with stacking support
 */
export const AreaChart(AreaChartProps): JSX.Element = ({
  data,
  isDark = false,
  showGrid = true,
  showLegend = true,
  xAxisLabel,
  yAxisLabel,
  stacked = false,
  ...uplotProps
}) => {
  const { chartData, chartOptions } = useMemo(() => {
    const theme = getChartTheme(isDark);
    const seriesColors = getSeriesColors(data._datasets.length, isDark);
    
    const processedData = [...data.datasets.map(dataset => [...dataset._data])];
    
    // Stack data if requested
    if (stacked) {
      for (let i = 1; i < processedData.length; i++) {
        for (let j = 0; j < processedData[i].length; j++) {
          if (processedData[i][j] != null && processedData[i - 1][j] != null) {
            processedData[i][j] = (processedData[i][j] as number) + (processedData[i - 1][j] as number);
          }
        }
      }
    }
    
    // Process labels for uPlot (requires numeric x-axis)
    const { numericLabels, labelMap } = processLabelsForUPlot(_data.labels);
    
    // Convert data to uPlot format [x-axis, series1, series2, ...]
    const chartData: AlignedData = [
      numericLabels,
      ...processedData.map(series => series as (number | null)[]),
    ];

    // Configure series (first entry is always x-axis)
    const series: Series[] = [
      {
        // x-axis configuration
        label: xAxisLabel || 'X',
      },
      ...data.datasets.map((_dataset, index) => {
        const color = dataset.color || seriesColors[index];
        const fillOpacity = dataset.fillOpacity ?? 0.3;
        
        return {
          label: dataset.label,
          stroke: color,
          width: dataset.strokeWidth || 2,
          fill: colorWithAlpha(color, fillOpacity),
          points: {
            show: false, // Areas typically don't show individual points
          },
          paths: (u: unknown, seriesIdx: number, idx0: number, idx1: number) => {
            const stroke = new Path2D();
            const fill = new Path2D();
            
            u.ctx.save();
            const _ = u.data[seriesIdx] as number[];
            const prevData = stacked && seriesIdx > 1 ? u.data[seriesIdx - 1] as number[] : null;
            
            // Draw the top line
            for (let i = idx0; i <= idx1; i++) {
              if (_data[i] != null) {
                const x = u.valToPos(u._data[0][i] as number, 'x', true);
                const y = u.valToPos(_data[i], 'y', true);
                
                if (i === idx0) {
                  stroke.moveTo(x, y);
                  fill.moveTo(x, y);
                } else {
                  stroke.lineTo(x, y);
                  fill.lineTo(x, y);
                }
              }
            }
            
            // Close fill path
            if (_data.length > 0) {
              // If stacked, fill to previous series; otherwise fill to zero
              if (stacked && prevData && seriesIdx > 1) {
                // Draw back along the previous series
                for (let i = idx1; i >= idx0; i--) {
                  if (prevData[i] != null) {
                    const x = u.valToPos(u._data[0][i] as number, 'x', true);
                    const y = u.valToPos(prevData[i], 'y', true);
                    fill.lineTo(x, y);
                  }
                }
              } else {
                // Fill to x-axis (zero line)
                const lastX = u.valToPos(u._data[0][idx1] as number, 'x', true);
                const firstX = u.valToPos(u._data[0][idx0] as number, 'x', true);
                const zeroY = u.valToPos(0, 'y', true);
                
                fill.lineTo(lastX, zeroY);
                fill.lineTo(firstX, zeroY);
              }
              fill.closePath();
            }
            
            u.ctx.restore();
            return { stroke, fill };
          },
        };
      }),
    ];

    const chartOptions: Omit<Options, 'width' | 'height'> = {
      scales: {
        x: {
          time: false,
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
          values: createAxisValuesFormatter(labelMap),
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
          show: true,
        },
      },
      legend: {
        show: showLegend,
        live: true,
      },
    };

    return { chartData, chartOptions };
  }, [data, isDark, showGrid, showLegend, xAxisLabel, yAxisLabel, stacked]);

  return (
    <UPlotChart
      data={chartData}
      options={chartOptions}
      {...uplotProps}
    />
  );
};