import { useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SkeletonChartProps {
  className?: string;
  height?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'scatter' | 'bar' | 'line' | 'quadrant';
  showLegend?: boolean;
  showAxes?: boolean;
}

// Constants for chart configuration
const CHART_CONFIG = {
  SCATTER_DOTS: 12,
  BAR_COUNT: 8,
  LINE_POINTS: 5,
  QUADRANT_DOTS_PER_SECTION: 3,
  QUADRANT_SECTIONS: 4,
  AXIS_LABELS: {
    Y: 5,
    X: 6,
  },
  LEGEND_ITEMS: 4,
} as const;

const heightClasses = {
  sm: 'h-48',
  md: 'h-64',
  lg: 'h-80',
  xl: 'h-96',
};

/**
 * SkeletonChart component for displaying animated placeholder charts
 *
 * @param className - Additional CSS classes to apply
 * @param height - Chart height variant: sm, md, lg, or xl
 * @param variant - Chart type: scatter, bar, line, or quadrant
 * @param showLegend - Whether to display chart legend
 * @param showAxes - Whether to display chart axes
 * @returns A skeleton chart component with optimized performance
 */
export function SkeletonChart({
  className,
  height = 'lg',
  variant = 'scatter',
  showLegend = false,
  showAxes = true,
}: SkeletonChartProps) {
  // Pre-generate static positions to avoid Math.random() calls during render
  const positions = useMemo(
    () => ({
      scatter: Array.from({ length: CHART_CONFIG.SCATTER_DOTS }, (_, i) => ({
        left: Math.random() * 80 + 10,
        top: Math.random() * 70 + 15,
        key: `scatter-${i}`,
      })),
      bar: Array.from({ length: CHART_CONFIG.BAR_COUNT }, (_, i) => ({
        height: Math.random() * 60 + 20,
        key: `bar-${i}`,
      })),
      line: Array.from({ length: CHART_CONFIG.LINE_POINTS }, (_, i) => ({
        left: 20 + i * 20,
        top: 80 - Math.random() * 60,
        key: `line-${i}`,
      })),
    }),
    []
  );
  const renderChartContent = () => {
    switch (variant) {
      case 'scatter':
        return (
          <div className="relative w-full h-full">
            {/* Scatter plot dots */}
            {positions.scatter.map((pos) => (
              <Skeleton
                key={pos.key}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                }}
              />
            ))}
          </div>
        );
      case 'quadrant':
        return (
          <div className="relative w-full h-full">
            {/* Quadrant grid */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
              {Array.from({ length: CHART_CONFIG.QUADRANT_SECTIONS }).map((_, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700">
                  {Array.from({ length: CHART_CONFIG.QUADRANT_DOTS_PER_SECTION }).map((_, j) => (
                    <Skeleton key={j} className="w-2 h-2 rounded-full m-2" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      case 'bar':
        return (
          <div className="flex items-end justify-around h-full space-x-2">
            {positions.bar.map((pos) => (
              <Skeleton key={pos.key} className="w-8" style={{ height: `${pos.height}%` }} />
            ))}
          </div>
        );
      case 'line':
        return (
          <div className="relative w-full h-full">
            {/* Line chart path */}
            <div className="absolute inset-4">
              <Skeleton
                className="w-full h-1"
                style={{
                  clipPath: `polygon(0% 80%, 25% 60%, 50% 40%, 75% 20%, 100% 50%)`,
                }}
              />
            </div>
            {/* Data points */}
            {positions.line.map((pos) => (
              <Skeleton
                key={pos.key}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  left: `${pos.left}%`,
                  top: `${pos.top}%`,
                }}
              />
            ))}
          </div>
        );
      default:
        return <Skeleton className="w-full h-full" />;
    }
  };

  return (
    <div
      className={cn('animate-pulse skeleton-container skeleton-optimized', className)}
      aria-label="Loading chart..."
      aria-busy="true"
      role="img"
    >
      <div className={cn('relative', heightClasses[height])}>
        {/* Chart background */}
        <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          {renderChartContent()}
        </div>

        {/* Axes */}
        {showAxes && (
          <>
            {/* Y-axis */}
            <div className="absolute left-2 top-4 bottom-4 flex flex-col justify-between">
              {Array.from({ length: CHART_CONFIG.AXIS_LABELS.Y }).map((_, i) => (
                <Skeleton key={`y-axis-${i}`} className="w-8 h-3" />
              ))}
            </div>
            {/* X-axis */}
            <div className="absolute bottom-2 left-12 right-4 flex justify-between">
              {Array.from({ length: CHART_CONFIG.AXIS_LABELS.X }).map((_, i) => (
                <Skeleton key={`x-axis-${i}`} className="w-12 h-3" />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 flex flex-wrap gap-4" aria-label="Chart legend loading">
          {Array.from({ length: CHART_CONFIG.LEGEND_ITEMS }).map((_, i) => (
            <div key={`legend-${i}`} className="flex items-center space-x-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="w-16 h-4" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
