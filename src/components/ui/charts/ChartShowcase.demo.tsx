import React, { useState, useMemo } from 'react';
import { LineChart, AreaChart, BarChart } from './index';
import { useTheme } from '@/components/common/theming/theme-provider';

/**
 * Comprehensive demo showcasing all chart types with theme switching
 * This demonstrates the migration from Recharts to uPlot-based components
 */
export const ChartShowcaseDemo: React.FC = () => {
  const { theme } = useTheme();
  const [selectedChart, setSelectedChart] = useState<'line' | 'area' | 'bar'>('line');

  // Determine if dark mode is active
  const isDark = useMemo(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    // For 'system', check the DOM
    return document.documentElement.classList.contains('dark');
  }, [theme]);

  // Sample data that mimics real contributor info
  const contributorData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Active Contributors',
        data: [45, 52, 48, 61, 55, 67, 72, 69, 58, 63, 71, 78],
        color: '#3b82f6',
        fillOpacity: 0.3,
      },
      {
        label: 'New Contributors',
        data: [12, 18, 15, 22, 19, 25, 28, 24, 21, 19, 26, 31],
        color: '#10b981',
        fillOpacity: 0.3,
      },
      {
        label: 'Returning Contributors',
        data: [33, 34, 33, 39, 36, 42, 44, 45, 37, 44, 45, 47],
        color: '#f59e0b',
        fillOpacity: 0.3,
      },
    ],
  };

  const repositoryData = {
    labels: ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'C++'],
    datasets: [
      {
        label: 'Active Repositories',
        data: [120, 85, 67, 45, 28, 23, 15],
        color: '#8b5cf6',
      },
      {
        label: 'New Repositories',
        data: [25, 18, 12, 8, 6, 4, 2],
        color: '#ef4444',
      },
    ],
  };

  const performanceData = {
    labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
    datasets: [
      {
        label: 'Response Time (ms)',
        data: Array.from({ length: 30 }, (_, i) =>
          Math.floor(Math.sin(i * 0.2) * 30 + Math.random() * 20 + 80)
        ),
        color: '#06b6d4',
        strokeWidth: 3,
      },
      {
        label: 'Error Rate (%)',
        data: Array.from({ length: 30 }, (_, i) =>
          Math.max(0, Math.floor(Math.cos(i * 0.15) * 2 + Math.random() * 3 + 2))
        ),
        color: '#f97316',
        strokeWidth: 2,
      },
    ],
  };

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Chart Migration Showcase</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Interactive demonstration of LineChart, AreaChart, and BarChart components built with
          uPlot, providing a Recharts-like API with better performance and theme support.
        </p>
      </div>

      {/* Theme indicator */}
      <div className="text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary">
          Current Theme: {isDark ? '🌙 Dark' : '☀️ Light'}
        </span>
      </div>

      {/* Chart type selector */}
      <div className="flex justify-center space-x-2">
        {(['line', 'area', 'bar'] as const).map((chartType) => (
          <button
            key={chartType}
            onClick={() => setSelectedChart(chartType)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedChart === chartType
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
          </button>
        ))}
      </div>

      {/* Main chart showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Primary chart */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Monthly Contributors</h2>
          <div className="bg-card border rounded-lg p-4">
            {selectedChart === 'line' && (
              <LineChart
                data={contributorData}
                height={350}
                isDark={isDark}
                showGrid={true}
                showLegend={true}
                xAxisLabel="Month"
                yAxisLabel="Contributors"
                responsive={true}
              />
            )}
            {selectedChart === 'area' && (
              <AreaChart
                data={contributorData}
                height={350}
                isDark={isDark}
                showGrid={true}
                showLegend={true}
                xAxisLabel="Month"
                yAxisLabel="Contributors"
                stacked={false}
                responsive={true}
              />
            )}
            {selectedChart === 'bar' && (
              <BarChart
                data={contributorData}
                height={350}
                isDark={isDark}
                showGrid={true}
                showLegend={true}
                xAxisLabel="Month"
                yAxisLabel="Contributors"
                grouped={true}
                responsive={true}
              />
            )}
          </div>
        </div>

        {/* Secondary chart - Repository Languages */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Repository Distribution</h2>
          <div className="bg-card border rounded-lg p-4">
            <BarChart
              data={repositoryData}
              height={350}
              isDark={isDark}
              showGrid={true}
              showLegend={true}
              xAxisLabel="Language"
              yAxisLabel="Repositories"
              grouped={true}
              responsive={true}
            />
          </div>
        </div>
      </div>

      {/* Additional demos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Stacked Area Chart */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Stacked Contributors</h2>
          <div className="bg-card border rounded-lg p-4">
            <AreaChart
              data={contributorData}
              height={300}
              isDark={isDark}
              showGrid={true}
              showLegend={true}
              xAxisLabel="Month"
              yAxisLabel="Total Contributors"
              stacked={true}
              responsive={true}
            />
          </div>
        </div>

        {/* Performance Line Chart */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Performance Metrics</h2>
          <div className="bg-card border rounded-lg p-4">
            <LineChart
              data={performanceData}
              height={300}
              isDark={isDark}
              showGrid={true}
              showLegend={true}
              xAxisLabel="Days"
              yAxisLabel="Value"
              responsive={true}
            />
          </div>
        </div>
      </div>

      {/* Features showcase */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Migration Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div className="space-y-2">
            <h3 className="font-medium text-primary">✨ Performance</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Built on uPlot for better performance</li>
              <li>• Optimized for large datasets</li>
              <li>• Minimal bundle size impact</li>
              <li>• Smooth animations</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-primary">🎨 Theming</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Automatic dark/light mode</li>
              <li>• Consistent with design system</li>
              <li>• Customizable color palettes</li>
              <li>• CSS variable integration</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-primary">📱 Responsive</h3>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Auto-sizing with ResizeObserver</li>
              <li>• Mobile-friendly interactions</li>
              <li>• Retina display optimized</li>
              <li>• Flexible layout support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Compatibility note */}
      <div className="bg-muted/50 border rounded-lg p-4 text-center">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Migration Ready:</strong> These components provide a Recharts-compatible API
          for easy migration of existing charts while offering improved performance and theme
          integration.
        </p>
      </div>
    </div>
  );
};
