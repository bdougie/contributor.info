import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Info, Layout, X } from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { UPlotChart } from '@/components/ui/charts/UPlotChart';
import type { AlignedData, Options } from 'uplot';
import { useMemo, useState, useEffect } from 'react';

// Custom hook to detect dark mode
function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial state
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkDarkMode();

    // Set up observer for class changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}

export interface ActivityDataPoint {
  date: string;
  additions: number;
  deletions: number;
  commits: number;
  files_changed: number;
}

export interface ActivityChartProps {
  title?: string;
  description?: string;
  data: ActivityDataPoint[];
  loading?: boolean;
  height?: number;
  className?: string;
  emptyMessage?: string;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

// Color scheme for the candlestick chart
const COLORS = {
  additions: '#10b981', // green for additions
  deletions: '#ef4444', // red for deletions
  neutral: '#6b7280', // gray for balanced changes
  grid: 'rgba(156, 163, 175, 0.2)',
  text: 'rgb(107, 114, 128)',
};

function prepareCandlestickData(_data: ActivityDataPoint[]): AlignedData {
  // uPlot expects data in column format: [x-values, ...series-values]
  const timestamps = data.map((_, idx) => idx); // Use indices for x-axis

  // For code changes:
  // - Body shows the range between additions and deletions
  // - Wicks extend to show the total impact
  const opens = data.map((d) => Math.min(d.additions, d.deletions));
  const closes = data.map((d) => Math.max(d.additions, d.deletions));

  // High is the maximum change, low is 0 (baseline)
  const highs = data.map((d) => Math.max(d.additions, d.deletions) * 1.1); // Add 10% for wick
  const lows = data.map(() => 0);

  // Volume is total lines changed (additions + deletions)
  const volumes = data.map((d) => d.additions + d.deletions);

  return [timestamps, lows, opens, closes, highs, volumes];
}

function createCandlestickOptions(
  data: ActivityDataPoint[],
  height: number,
  isDark: boolean,
): Options {
  const textColor = isDark ? 'rgb(156, 163, 175)' : COLORS.text;
  const gridColor = isDark ? 'rgba(75, 85, 99, 0.3)' : COLORS.grid;

  return {
    width: 800, // Will be overridden by responsive sizing
    height,
    scales: {
      x: {
        time: false,
      },
      y: {
        range: (_u, dataMin, _dataMax) => {
          const padding = (dataMax - _dataMin) * 0.1;
          return [dataMin - padding, dataMax + padding];
        },
      },
      volume: {
        range: [0, 1],
      },
    },
    axes: [
      {
        stroke: textColor,
        grid: {
          show: true,
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
            const point = data[Math.round(idx)];
            if (!point) return '';
            return new Date(point.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
          }),
      },
      {
        stroke: textColor,
        grid: {
          show: true,
          stroke: gridColor,
          width: 1,
        },
        ticks: {
          show: true,
          stroke: gridColor,
          width: 1,
        },
        size: 60,
        values: (_u, splits) =>
          splits.map((v) => {
            if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
            return v.toString();
          }),
      },
    ],
    series: [
      {
        label: 'Date',
      },
      {
        label: 'Low',
        paths: () => null,
      },
      {
        label: 'Open',
        paths: () => null,
      },
      {
        label: 'Close',
        paths: () => null,
      },
      {
        label: 'High',
        paths: () => null,
      },
      {
        label: 'Volume',
        scale: 'volume',
        paths: () => null,
      },
    ],
    plugins: [
      {
        hooks: {
          draw: [
            (u) => {
              const ctx = u.ctx;
              const { left, top, width, height } = u.bbox;

              // Save context state
              ctx.save();

              const xData = u.data[0];
              const lowData = u.data[1];
              const openData = u.data[2];
              const closeData = u.data[3];
              const highData = u.data[4];
              const volumeData = u.data[5];

              if (!xData || !lowData || !openData || !closeData || !highData || !volumeData) return;

              // Calculate dimensions
              const candleHeight = height * 0.7;
              const volumeHeight = height * 0.25;
              const volumeTop = top + candleHeight + height * 0.05;

              // Calculate bar width based on number of data points
              const barWidth = Math.max(2, Math.min(12, (width / xData.length) * 0.7));

              // Find max volume for scaling
              const maxVolume = Math.max(
                ...Array.from(volumeData).filter((v): v is number => v != null),
              );

              // Clear the volume area to remove any grid lines that extend there
              // Use the isDark parameter passed to createCandlestickOptions
              ctx.fillStyle = isDark ? '#0a0a0a' : '#ffffff';
              ctx.fillRect(left, volumeTop - 2, width, volumeHeight + 4);

              // Draw volume bars first (behind candlesticks)
              for (let i = 0; i < xData.length; i++) {
                const xPos = u.valToPos(xData[i], 'x', true);
                const volume = volumeData[i] || 0;
                const volHeight = (volume / maxVolume) * volumeHeight;

                // Color based on additions vs deletions
                const point = data[i];
                if (point) {
                  const ratio = point.additions / (point.additions + point.deletions + 1);
                  if (ratio > 0.6) {
                    ctx.fillStyle = COLORS.additions + '40'; // 25% opacity
                  } else if (ratio < 0.4) {
                    ctx.fillStyle = COLORS.deletions + '40';
                  } else {
                    ctx.fillStyle = COLORS.neutral + '40';
                  }
                }

                ctx.fillRect(
                  xPos - barWidth / 2,
                  volumeTop + volumeHeight - volHeight,
                  barWidth,
                  volHeight,
                );
              }

              // Clip to candlestick area
              ctx.rect(left, top, width, candleHeight);
              ctx.clip();

              // Draw candlesticks
              for (let i = 0; i < xData.length; i++) {
                const xPos = u.valToPos(xData[i], 'x', true);
                const lowY = u.valToPos(lowData[i] || 0, 'y', true);
                const openY = u.valToPos(openData[i] || 0, 'y', true);
                const closeY = u.valToPos(closeData[i] || 0, 'y', true);
                const highY = u.valToPos(highData[i] || 0, 'y', true);

                // Determine color based on whether additions or deletions are dominant
                const point = data[i];
                let color = COLORS.neutral;
                if (point) {
                  const ratio = point.additions / (point.additions + point.deletions + 1);
                  if (ratio > 0.6) {
                    color = COLORS.additions;
                  } else if (ratio < 0.4) {
                    color = COLORS.deletions;
                  }
                }

                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                ctx.lineWidth = 1;

                // Draw the high-low line (wick)
                ctx.beginPath();
                ctx.moveTo(xPos, highY);
                ctx.lineTo(xPos, lowY);
                ctx.stroke();

                // Draw the open-close box (body)
                const bodyTop = Math.min(openY, closeY);
                const bodyHeight = Math.abs(closeY - openY) || 2;

                // Hollow or filled based on direction
                if (closeY < openY) {
                  // Additions > Deletions: filled green
                  ctx.fillRect(xPos - barWidth / 2, bodyTop, barWidth, bodyHeight);
                } else {
                  // Deletions > Additions: hollow red
                  ctx.strokeRect(xPos - barWidth / 2, bodyTop, barWidth, bodyHeight);
                }
              }

              // Restore context state
              ctx.restore();

              return false;
            },
          ],
        },
      },
    ],
    legend: {
      show: false,
    },
    cursor: {
      points: {
        show: false,
      },
    },
  };
}

export function ActivityChart({
  title = 'Code Activity',
  description,
  data,
  loading = false,
  height = 300,
  className,
  emptyMessage = 'No activity data available for the selected period',
  isExpanded = false,
  onExpandToggle,
}: ActivityChartProps) {
  const hasData = data && data.length > 0;
  const isDarkMode = useIsDarkMode();
  const [tooltipData, setTooltipData] = useState<{
    x: number;
    y: number;
    point: ActivityDataPoint;
  } | null>(null);

  const chartData = useMemo(() => {
    if (!hasData) return null;
    return prepareCandlestickData(_data);
  }, [data, hasData]);

  const chartOptions = useMemo(() => {
    if (!hasData) return null;
    const options = createCandlestickOptions(_data, height, isDarkMode);

    // Add setCursor hook for tooltips
    options.hooks = {
      setCursor: [
        (u) => {
          const idx = u.cursor.idx;
          if (idx != null && _data[idx]) {
            const rect = u.over.getBoundingClientRect();
            const x = u.valToPos(idx, 'x', true);
            setTooltipData({
              x: rect.left + x,
              y: rect.top,
              point: data[idx],
            });
          } else {
            setTooltipData(null);
          }
        },
      ],
    };

    return options;
  }, [data, height, hasData, isDarkMode]);

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
    <Card className={cn('transition-all duration-500 ease-in-out', className)}>
      <CardHeader>
        <div className="flex flex-col gap-3">
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
          {/* Activity Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#10b981' }} />
              <span>Mostly additions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
              <span>Mostly deletions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#6b7280' }} />
              <span>Balanced changes</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        {hasData && chartData && chartOptions ? (
          <div
            style={{ height }}
            className="pr-2 transition-[height] duration-500 ease-in-out relative"
            onMouseLeave={() => setTooltipData(null)}
          >
            <UPlotChart data={chartData} options={chartOptions} height={height} responsive={true} />
            {tooltipData && (
              <div
                className="absolute pointer-events-none z-50"
                style={{
                  left: tooltipData.x,
                  top: tooltipData.y - 100,
                  transform: 'translateX(-50%)',
                }}
              >
                <div className="bg-popover text-popover-foreground rounded-md border shadow-md p-2">
                  <div className="font-semibold text-sm mb-1">
                    {new Date(tooltipData.point.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 dark:text-green-400">
                        +{tooltipData.point.additions.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">additions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 dark:text-red-400">
                        -{tooltipData.point.deletions.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">deletions</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t">
                      <span className="font-medium">
                        {(
                          tooltipData.point.additions + tooltipData.point.deletions
                        ).toLocaleString()}
                      </span>
                      <span className="text-muted-foreground">total lines</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
export function ActivityChartSkeleton({
  className,
  height = 300,
}: {
  className?: string;
  height?: number;
}) {
  return <ActivityChart data={[]} loading={true} className={className} height={height} />;
}
