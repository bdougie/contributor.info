import React, { useMemo } from 'react';
import { ResponsiveHeatMap } from '@nivo/heatmap';
import type { HeatmapData } from './heatmap-mock-data';
import { transformDataForNivo, getHeatmapColorScheme } from './heatmap-utils';
import { getChartTheme } from '../theme-config';

export interface HeatmapNivoProps {
  data: HeatmapData;
  height?: number;
  isDark?: boolean;
  colorScheme?: 'default' | 'github' | 'traffic';
  showLegend?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onCellClick?: (data: { file: string; period: string; value: number }) => void;
}

/**
 * Heatmap component using Nivo
 * Visualizes file activity over time periods with color intensity
 */
export const HeatmapNivo: React.FC<HeatmapNivoProps> = ({
  data,
  height = 600,
  isDark = false,
  colorScheme = 'default',
  showLegend = true,
  loading = false,
  emptyMessage = 'No activity data available',
  onCellClick,
}) => {
  const { nivoData, colorSchemeValue, theme, isEmpty, maxValue } = useMemo(() => {
    const theme = getChartTheme(isDark);
    const colorConfig = getHeatmapColorScheme(isDark, colorScheme);
    const nivoData = transformDataForNivo(data);
    const isEmpty = data.files.length === 0 || data.data.length === 0;

    // Calculate max value for color scaling
    const maxValue = Math.max(...data.data.map((d) => d.changes), 0);

    return {
      nivoData,
      colorSchemeValue: colorConfig.scheme,
      theme,
      isEmpty,
      maxValue,
    };
  }, [data, isDark, colorScheme]);

  // Create a color function based on the scheme
  const getColor = (value: number): string => {
    if (value === 0 || maxValue === 0) {
      return isDark ? '#1e293b' : '#f1f5f9';
    }
    const ratio = value / maxValue;
    const colorIndex = Math.floor(ratio * (colorSchemeValue.length - 1));
    return colorSchemeValue[Math.min(colorIndex, colorSchemeValue.length - 1)];
  };

  if (loading) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg animate-pulse"
      >
        <div className="text-gray-500 dark:text-gray-400">Loading heatmap...</div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg"
      >
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveHeatMap
        data={nivoData}
        margin={{ top: 60, right: 90, bottom: 60, left: 200 }}
        valueFormat=">-.0f"
        axisTop={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: -45,
          legend: '',
          legendOffset: 46,
          ticksPosition: 'after',
          truncateTickAt: 0,
        }}
        axisRight={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'Files',
          legendPosition: 'middle',
          legendOffset: 70,
          truncateTickAt: 0,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: '',
          legendPosition: 'middle',
          legendOffset: -40,
          truncateTickAt: 0,
        }}
        colors={(cell) => getColor(cell.value as number)}
        emptyColor={isDark ? '#1e293b' : '#f1f5f9'}
        legends={
          showLegend
            ? [
                {
                  anchor: 'bottom',
                  translateX: 0,
                  translateY: 30,
                  length: 400,
                  thickness: 8,
                  direction: 'row',
                  tickPosition: 'after',
                  tickSize: 3,
                  tickSpacing: 4,
                  tickOverlap: false,
                  tickFormat: '>-.0s',
                  title: 'Changes →',
                  titleAlign: 'start',
                  titleOffset: 4,
                },
              ]
            : []
        }
        theme={{
          background: theme.background,
          text: {
            fill: theme.text,
            fontSize: 11,
          },
          axis: {
            domain: {
              line: {
                stroke: theme.axis,
                strokeWidth: 1,
              },
            },
            ticks: {
              line: {
                stroke: theme.axis,
                strokeWidth: 1,
              },
              text: {
                fill: theme.text,
                fontSize: 11,
              },
            },
            legend: {
              text: {
                fill: theme.text,
                fontSize: 12,
                fontWeight: 600,
              },
            },
          },
          legends: {
            text: {
              fill: theme.text,
              fontSize: 11,
            },
            title: {
              text: {
                fill: theme.text,
                fontSize: 12,
                fontWeight: 600,
              },
            },
          },
          tooltip: {
            container: {
              background: isDark ? '#1e293b' : '#ffffff',
              color: theme.text,
              fontSize: 12,
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              padding: '8px 12px',
            },
          },
        }}
        hoverTarget="cell"
        borderColor={{
          from: 'color',
          modifiers: [['darker', 0.4]],
        }}
        animate={true}
        motionConfig="gentle"
        onClick={
          onCellClick
            ? (cell) => {
                // Find the original data point
                const dataPoint = data.data.find(
                  (d) => d.file === cell.serieId && d.period === cell.data.x
                );
                if (dataPoint) {
                  onCellClick({
                    file: dataPoint.file,
                    period: dataPoint.period,
                    value: dataPoint.changes,
                  });
                }
              }
            : undefined
        }
      />
    </div>
  );
};
