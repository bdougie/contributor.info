/**
 * Theme configuration for uPlot charts
 * Provides consistent colors and styles for light/dark modes
 */

export interface ChartTheme {
  background: string;
  grid: string;
  axis: string;
  text: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

export const lightTheme: ChartTheme = {
  background: '#ffffff',
  grid: 'rgba(0, 0, 0, 0.1)',
  axis: '#6b7280',
  text: '#374151',
  colors: {
    primary: '#3b82f6',
    secondary: '#10b981',
    accent: '#8b5cf6',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#06b6d4',
  },
};

export const darkTheme: ChartTheme = {
  background: '#0f172a',
  grid: 'rgba(255, 255, 255, 0.1)',
  axis: '#9ca3af',
  text: '#e5e7eb',
  colors: {
    primary: '#60a5fa',
    secondary: '#34d399',
    accent: '#a78bfa',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#22d3ee',
  },
};

/**
 * Get theme based on current dark mode state
 */
export function getChartTheme(isDark: boolean): ChartTheme {
  return isDark ? darkTheme : lightTheme;
}

/**
 * Default color palette matching existing design system
 */
export const defaultColors = [
  '#3b82f6', // blue
  '#10b981', // green
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
];

/**
 * Generate uPlot series colors based on theme
 */
export function getSeriesColors(count: number, isDark: boolean): string[] {
  const theme = getChartTheme(isDark);
  const colors = Object.values(theme.colors);

  // Extend with default colors if needed
  const allColors = [...colors, ...defaultColors];

  return Array.from({ length: count }, (_, i) => allColors[i % allColors.length]);
}
