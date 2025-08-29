import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Info, Layout, X } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { UPlotChart } from '@/components/ui/charts/UPlotChart';
import type { AlignedData, Options } from 'uplot';
import { useMemo, useState } from 'react';

export interface TrendChartProps {
  title: string;
  description?: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: (number | null)[];
      color?: string;
    }>;
  };
  loading?: boolean;
  height?: number;
  className?: string;
  timeRange?: '7d' | '30d' | '90d';
  onTimeRangeChange?: (range: '7d' | '30d' | '90d') => void;
  showLegend?: boolean;
  showGrid?: boolean;
  yAxisLabel?: string;
  emptyMessage?: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

// Default colors for datasets
const DEFAULT_COLORS = [
  '#10b981', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f97316', // orange
  '#ef4444', // red
  '#06b6d4', // cyan
];

function prepareUPlotData(
  labels: string[],
  datasets: Array<{ data: (number | null)[] }>
): AlignedData {
  // uPlot expects data in column format: [x-values, ...series-values]
  const xValues = labels.map((_, idx) => idx);
  const seriesData = datasets.map((ds) => ds.data.map((v) => (v === null ? null : v)));

  return [xValues, ...seriesData];
}

function createUPlotOptions(
  labels: string[],
  datasets: Array<{ label: string; color?: string }>,
  height: number,
  showLegend: boolean,
  showGrid: boolean,
  yAxisLabel?: string,
  isDark: boolean = false
): Options {
  const textColor = isDark ? 'rgb(156, 163, 175)' : 'rgb(107, 114, 128)';
  const gridColor = isDark ? 'rgba(75, 85, 99, 0.3)' : 'rgba(156, 163, 175, 0.2)';

  return {
    width: 800, // Initial width, will be overridden by responsive sizing
    height,
    scales: {
      x: {
        time: false,
      },
      y: {
        range: (_u, dataMin, dataMax) => {
          const padding = (dataMax - dataMin) * 0.1;
          return [Math.max(0, dataMin - padding), dataMax + padding];
        },
      },
    },
    axes: [
      {
        stroke: textColor,
        grid: {
          show: showGrid,
          stroke: gridColor,
          width: 1,
        },
        ticks: {
          show: true,
          stroke: gridColor,
          width: 1,
        },
        values: (_u, splits) =>
          splits.map((idx) => {
            const label = labels[Math.round(idx)];
            return label || '';
          }),
      },
      {
        stroke: textColor,
        grid: {
          show: showGrid,
          stroke: gridColor,
          width: 1,
        },
        ticks: {
          show: true,
          stroke: gridColor,
          width: 1,
        },
        size: 60,
        label: yAxisLabel,
        labelSize: 12,
        labelFont: 'system-ui, -apple-system, sans-serif',
        values: (_u, splits) =>
          splits.map((v) => {
            if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
            if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
            return v.toString();
          }),
      },
    ],
    series: [
      {
        label: 'Index',
      },
      ...datasets.map((ds, idx) => ({
        label: ds.label,
        stroke: ds.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
        width: 2,
        points: {
          show: false,
        },
      })),
    ],
    legend: {
      show: showLegend,
      live: false,
    },
    cursor: {
      points: {
        size: 8,
        width: 2,
        stroke: (_u, seriesIdx) => {
          if (seriesIdx === 0) return 'transparent';
          const dataset = datasets[seriesIdx - 1];
          return dataset?.color || DEFAULT_COLORS[(seriesIdx - 1) % DEFAULT_COLORS.length];
        },
        fill: (_u, seriesIdx) => {
          if (seriesIdx === 0) return 'transparent';
          return 'white';
        },
      },
    },
  };
}

export function TrendChart({
  title,
  description,
  data,
  loading = false,
  height = 300,
  className,
  showLegend = true,
  showGrid = true,
  yAxisLabel,
  emptyMessage = 'No data available for the selected period',
  isExpanded = false,
  onExpandToggle,
}: TrendChartProps) {
  const hasData = data.datasets.some((dataset) =>
    dataset.data.some((value) => value !== null && value !== undefined)
  );

  const [selectedSeries, setSelectedSeries] = useState<Set<number>>(
    new Set(data.datasets.map((_, i) => i))
  );

  const toggleSeries = (index: number) => {
    setSelectedSeries((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const chartData = useMemo(() => {
    if (!hasData) return null;
    return prepareUPlotData(data.labels, data.datasets);
  }, [data, hasData]);

  const chartOptions = useMemo(() => {
    if (!hasData) return null;
    const options = createUPlotOptions(
      data.labels,
      data.datasets,
      height,
      false, // Don't use built-in legend
      showGrid,
      yAxisLabel,
      false // isDark - controlled by theme
    );

    // Update series visibility based on selection
    if (options.series) {
      options.series.forEach((s, i) => {
        if (i > 0) {
          // Skip x-axis series
          s.show = selectedSeries.has(i - 1);
        }
      });
    }

    return options;
  }, [data, height, showGrid, yAxisLabel, hasData, selectedSeries]);

  if (loading) {
    return (
      <Card className={cn('transition-all', className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('transition-all duration-500 ease-in-out w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {title}
              {description && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </CardTitle>
          </div>
          {onExpandToggle && (
            <Button variant="ghost" size="icon" onClick={onExpandToggle} className="h-8 w-8">
              {isExpanded ? <X className="h-4 w-4" /> : <Layout className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-2 w-full">
        {hasData && chartData && chartOptions ? (
          <div className="space-y-3 w-full">
            {showLegend && (
              <div className="flex flex-wrap gap-3 px-2">
                {data.datasets.map((dataset, index) => {
                  const color = dataset.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
                  const isSelected = selectedSeries.has(index);
                  return (
                    <button
                      key={index}
                      onClick={() => toggleSeries(index)}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium transition-all',
                        isSelected ? 'bg-opacity-100' : 'bg-transparent border'
                      )}
                      style={{
                        backgroundColor: isSelected ? `${color}20` : 'transparent',
                        borderColor: color,
                        color: isSelected ? color : 'currentColor',
                      }}
                    >
                      <span
                        className={cn('w-3 h-3 rounded-sm')}
                        style={{
                          backgroundColor: isSelected ? color : 'transparent',
                          borderColor: color,
                          borderWidth: isSelected ? 0 : '2px',
                          borderStyle: 'solid',
                        }}
                      />
                      <span>{dataset.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ height }} className="w-full transition-[height] duration-500 ease-in-out">
              <UPlotChart
                data={chartData}
                options={chartOptions}
                height={height}
                responsive={true}
              />
            </div>
          </div>
        ) : (
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ height }}
          >
            <div className="text-center">
              <p className="text-sm">{emptyMessage}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Skeleton component for easier usage
export function TrendChartSkeleton({
  className,
  height = 300,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <TrendChart
      title=""
      data={{ labels: [], datasets: [] }}
      loading={true}
      className={className}
      height={height}
    />
  );
}
