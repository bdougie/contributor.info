/**
 * Utility functions for heatmap data transformation and formatting
 */

import type { HeatmapData } from './heatmap-mock-data';
import { getChartTheme } from '../theme-config';

/**
 * Nivo heatmap expects data in format:
 * [
 *   { id: 'file1', data: [{ x: 'Week 1', y: 5 }, { x: 'Week 2', y: 10 }] },
 *   { id: 'file2', data: [{ x: 'Week 1', y: 3 }, { x: 'Week 2', y: 8 }] }
 * ]
 */
interface NivoHeatmapDataPoint {
  x: string;
  y: number;
}

interface NivoHeatmapSeries {
  id: string;
  data: NivoHeatmapDataPoint[];
}

export function transformDataForNivo(heatmapData: HeatmapData): NivoHeatmapSeries[] {
  const { files, data } = heatmapData;

  return files.map((file) => {
    const fileData = data.filter((d) => d.file === file);

    return {
      id: truncateFilePath(file, 40),
      data: fileData.map((d) => ({
        x: d.period,
        y: d.changes,
      })),
    };
  });
}

/**
 * Recharts expects data in a flat structure:
 * [
 *   { file: 'src/index.ts', 'Week 1': 5, 'Week 2': 10, ... },
 *   { file: 'src/App.tsx', 'Week 1': 3, 'Week 2': 8, ... }
 * ]
 */
interface RechartsHeatmapDataPoint {
  file: string;
  [period: string]: string | number;
}

export function transformDataForRecharts(heatmapData: HeatmapData): RechartsHeatmapDataPoint[] {
  const { files, data } = heatmapData;

  return files.map((file) => {
    const fileData = data.filter((d) => d.file === file);

    const row: RechartsHeatmapDataPoint = {
      file: truncateFilePath(file, 40),
    };

    fileData.forEach((d) => {
      row[d.period] = d.changes;
    });

    return row;
  });
}

/**
 * Truncate file paths to prevent UI overflow
 * Keeps the filename and a portion of the path
 */
export function truncateFilePath(filePath: string, maxLength: number): string {
  if (filePath.length <= maxLength) {
    return filePath;
  }

  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];

  // If filename alone is too long, truncate it
  if (filename.length >= maxLength - 3) {
    return `...${filename.slice(-(maxLength - 3))}`;
  }

  // Try to keep some path context
  const remaining = maxLength - filename.length - 4; // 4 for ".../"
  let pathPrefix = parts.slice(0, -1).join('/');

  if (pathPrefix.length > remaining) {
    pathPrefix = pathPrefix.slice(-remaining);
    // Try to start at a path separator
    const slashIndex = pathPrefix.indexOf('/');
    if (slashIndex > 0) {
      pathPrefix = pathPrefix.slice(slashIndex + 1);
    }
  }

  return `.../${pathPrefix}/${filename}`;
}

/**
 * Color scheme definitions for heatmaps
 */
export interface HeatmapColorScheme {
  type: 'sequential';
  scheme: string[];
  minValue?: number;
  maxValue?: number;
}

/**
 * Get heatmap color scheme based on theme and type
 */
export function getHeatmapColorScheme(
  isDark: boolean,
  type: 'default' | 'github' | 'traffic' = 'default'
): HeatmapColorScheme {
  const theme = getChartTheme(isDark);

  switch (type) {
    case 'github':
      // GitHub-style contribution graph colors
      return {
        type: 'sequential',
        scheme: isDark
          ? ['#0e4429', '#006d32', '#26a641', '#39d353']
          : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
      };

    case 'traffic':
      // Traffic light style (low to high activity)
      return {
        type: 'sequential',
        scheme: isDark
          ? [theme.colors.success, theme.colors.warning, theme.colors.error]
          : ['#22c55e', '#f59e0b', '#ef4444'],
      };

    case 'default':
    default:
      // Blue gradient (matches primary brand color)
      return {
        type: 'sequential',
        scheme: isDark
          ? ['#1e3a8a', '#3b82f6', '#60a5fa', '#93c5fd']
          : ['#dbeafe', '#93c5fd', '#3b82f6', '#1e40af'],
      };
  }
}

/**
 * Calculate statistics for heatmap data
 */
export interface HeatmapStats {
  totalChanges: number;
  maxChanges: number;
  minChanges: number;
  avgChanges: number;
  filesWithActivity: number;
  totalFiles: number;
}

export function calculateHeatmapStats(heatmapData: HeatmapData): HeatmapStats {
  const { data, files } = heatmapData;

  if (data.length === 0) {
    return {
      totalChanges: 0,
      maxChanges: 0,
      minChanges: 0,
      avgChanges: 0,
      filesWithActivity: 0,
      totalFiles: 0,
    };
  }

  const changes = data.map((d) => d.changes);
  const totalChanges = changes.reduce((sum, val) => sum + val, 0);
  const maxChanges = Math.max(...changes);
  const minChanges = Math.min(...changes);
  const avgChanges = totalChanges / changes.length;

  // Count unique files with at least one change
  const filesWithActivity = new Set(data.filter((d) => d.changes > 0).map((d) => d.file)).size;

  return {
    totalChanges,
    maxChanges,
    minChanges,
    avgChanges: Math.round(avgChanges * 10) / 10,
    filesWithActivity,
    totalFiles: files.length,
  };
}

/**
 * Format large numbers for display
 */
export function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}
