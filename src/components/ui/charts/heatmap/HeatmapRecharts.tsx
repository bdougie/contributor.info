import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { HeatmapData } from './heatmap-mock-data';
import { getHeatmapColorScheme } from './heatmap-utils';
import { getChartTheme } from '../theme-config';

export interface HeatmapRechartsProps {
  data: HeatmapData;
  height?: number;
  isDark?: boolean;
  colorScheme?: 'default' | 'github' | 'traffic';
  showLegend?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onCellClick?: (data: { file: string; period: string; value: number }) => void;
}

interface ScatterDataPoint {
  x: number;
  y: number;
  value: number;
  file: string;
  period: string;
}

/**
 * Heatmap component using Recharts
 * Custom implementation using ScatterChart with colored cells
 */
export const HeatmapRecharts: React.FC<HeatmapRechartsProps> = ({
  data,
  height = 600,
  isDark = false,
  colorScheme = 'default',
  showLegend = true,
  loading = false,
  emptyMessage = 'No activity data available',
  onCellClick,
}) => {
  const { scatterData, maxValue, colors, theme, isEmpty } = useMemo(() => {
    const theme = getChartTheme(isDark);
    const colorConfig = getHeatmapColorScheme(isDark, colorScheme);
    const isEmpty = data.files.length === 0 || data.data.length === 0;

    if (isEmpty) {
      return {
        scatterData: [],
        maxValue: 0,
        colors: colorConfig.scheme,
        theme,
        isEmpty,
      };
    }

    // Convert data to scatter plot format with x/y coordinates
    const scatterData: ScatterDataPoint[] = [];
    const periodIndices = new Map(data.periods.map((p, i) => [p, i]));
    const fileIndices = new Map(data.files.map((f, i) => [f, i]));

    let maxValue = 0;

    data.data.forEach((point) => {
      const x = periodIndices.get(point.period) ?? 0;
      const y = fileIndices.get(point.file) ?? 0;
      maxValue = Math.max(maxValue, point.changes);

      scatterData.push({
        x,
        y,
        value: point.changes,
        file: point.file,
        period: point.period,
      });
    });

    return {
      scatterData,
      maxValue,
      colors: colorConfig.scheme,
      theme,
      isEmpty,
    };
  }, [data, isDark, colorScheme]);

  // Calculate color for a cell based on its value
  const getCellColor = (value: number): string => {
    if (value === 0 || maxValue === 0) {
      return isDark ? '#1e293b' : '#f1f5f9';
    }

    const ratio = value / maxValue;
    const colorIndex = Math.floor(ratio * (colors.length - 1));
    return colors[Math.min(colorIndex, colors.length - 1)];
  };

  // Custom tooltip
  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: ScatterDataPoint[];
  }) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0] as unknown as ScatterDataPoint;
      return (
        <div
          style={{
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            color: theme.text,
            border: `1px solid ${theme.grid}`,
            borderRadius: '4px',
            padding: '8px 12px',
            fontSize: '12px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{data.file}</div>
          <div>{data.period}</div>
          <div style={{ marginTop: '4px', fontWeight: 600 }}>Changes: {data.value}</div>
        </div>
      );
    }
    return null;
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

  // Calculate cell size based on data dimensions
  const cellSize = Math.min(40, Math.floor(height / (data.files.length + 2)));

  return (
    <div style={{ height, backgroundColor: theme.background }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart
          margin={{ top: 60, right: 20, bottom: 60, left: 200 }}
          onClick={(e) => {
            if (e && e.activePayload && e.activePayload.length > 0 && onCellClick) {
              const cellData = e.activePayload[0].payload as ScatterDataPoint;
              onCellClick({
                file: cellData.file,
                period: cellData.period,
                value: cellData.value,
              });
            }
          }}
        >
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, data.periods.length - 1]}
            ticks={data.periods.map((_, i) => i)}
            tickFormatter={(value: number) => data.periods[value] || ''}
            stroke={theme.axis}
            tick={{ fill: theme.text, fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, data.files.length - 1]}
            ticks={data.files.map((_, i) => i)}
            tickFormatter={(value: number) => {
              const file = data.files[value];
              // Truncate long file paths
              return file && file.length > 35 ? `...${file.slice(-35)}` : file || '';
            }}
            stroke={theme.axis}
            tick={{ fill: theme.text, fontSize: 11 }}
            width={180}
          />
          <ZAxis type="number" dataKey="value" range={[cellSize * cellSize, cellSize * cellSize]} />
          <Tooltip content={<CustomTooltip />} cursor={false} />
          <Scatter data={scatterData} shape="square">
            {scatterData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getCellColor(entry.value)}
                stroke={isDark ? '#334155' : '#cbd5e1'}
                strokeWidth={1}
                style={{ cursor: onCellClick ? 'pointer' : 'default' }}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {showLegend && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px',
            gap: '8px',
          }}
        >
          <span style={{ color: theme.text, fontSize: '12px', fontWeight: 600 }}>Changes:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: theme.text, fontSize: '11px' }}>Low</span>
            {colors.map((color, index) => (
              <div
                key={index}
                style={{
                  width: '24px',
                  height: '12px',
                  backgroundColor: color,
                  border: `1px solid ${theme.grid}`,
                }}
              />
            ))}
            <span style={{ color: theme.text, fontSize: '11px' }}>High</span>
          </div>
        </div>
      )}
    </div>
  );
};
