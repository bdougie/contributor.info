import React, { useMemo } from 'react';
import { UPlotChart, type UPlotChartProps } from './UPlotChart';
import { getChartTheme, getSeriesColors } from './theme-config';
import { processLabelsForUPlot, createAxisValuesFormatter, colorWithAlpha } from './chart-utils';
import type { AlignedData, Options, Series } from 'uplot';

export interface LineChartProps extends Omit<UPlotChartProps, 'data' | 'options'> {
  data: {
    labels: (string | number)[];
    datasets: Array<{
      label: string;
      data: (number | null)[];
      color?: string;
      strokeWidth?: number;
      fill?: boolean;
      points?: boolean;
    }>;
  };
  isDark?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
}

/**
 * LineChart component using uPlot
 * Provides a Recharts-like API for easy migration
 */
export const LineChart: React.FC<LineChartProps> = ({
  data,
  isDark = false,
  showGrid = true,
  showLegend = true,
  xAxisLabel,
  yAxisLabel,
  ...uplotProps
}) => {
  const { chartData, chartOptions } = useMemo(() => {
    const theme = getChartTheme(isDark);
    const seriesColors = getSeriesColors(data.datasets.length, isDark);

    // Process labels for uPlot (requires numeric x-axis)
    const { numericLabels, labelMap } = processLabelsForUPlot(data.labels);

    // Convert data to uPlot format [x-axis, series1, series2, ...]
    const chartData: AlignedData = [
      numericLabels,
      ...data.datasets.map((dataset) => dataset.data as (number | null)[]),
    ];

    // Configure series (first entry is always x-axis)
    const series: Series[] = [
      {
        // x-axis configuration
        label: xAxisLabel || 'X',
      },
      ...data.datasets.map((dataset, index) => ({
        label: dataset.label,
        stroke: dataset.color || seriesColors[index],
        width: dataset.strokeWidth || 2,
        fill: dataset.fill
          ? colorWithAlpha(dataset.color || seriesColors[index], 0.125)
          : undefined,
        points: {
          show: dataset.points !== false,
          size: 4,
          width: 1,
        },
        ...(dataset.fill && {
          paths: (u, seriesIdx, idx0, idx1) => {
            const stroke = new Path2D();
            const fill = new Path2D();

            u.ctx.save();
            const data = u.data[seriesIdx] as number[];

            for (let i = idx0; i <= idx1; i++) {
              if (data[i] != null) {
                const x = u.valToPos(u.data[0][i] as number, 'x', true);
                const y = u.valToPos(data[i], 'y', true);

                if (i === idx0) {
                  stroke.moveTo(x, y);
                  fill.moveTo(x, y);
                } else {
                  stroke.lineTo(x, y);
                  fill.lineTo(x, y);
                }
              }
            }

            // Close fill path to x-axis
            if (data.length > 0) {
              const lastX = u.valToPos(u.data[0][idx1] as number, 'x', true);
              const firstX = u.valToPos(u.data[0][idx0] as number, 'x', true);
              const zeroY = u.valToPos(0, 'y', true);

              fill.lineTo(lastX, zeroY);
              fill.lineTo(firstX, zeroY);
              fill.closePath();
            }

            u.ctx.restore();
            return { stroke, fill };
          },
        }),
      })),
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
  }, [data, isDark, showGrid, showLegend, xAxisLabel, yAxisLabel]);

  return <UPlotChart data={chartData} options={chartOptions} {...uplotProps} />;
};
