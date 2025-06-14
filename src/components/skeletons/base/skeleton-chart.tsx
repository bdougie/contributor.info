import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SkeletonChartProps {
  className?: string;
  height?: "sm" | "md" | "lg" | "xl";
  variant?: "scatter" | "bar" | "line" | "quadrant";
  showLegend?: boolean;
  showAxes?: boolean;
}

const heightClasses = {
  sm: "h-48",
  md: "h-64",
  lg: "h-80",
  xl: "h-96"
};

export function SkeletonChart({ 
  className, 
  height = "lg",
  variant = "scatter",
  showLegend = false,
  showAxes = true
}: SkeletonChartProps) {
  const renderChartContent = () => {
    switch (variant) {
      case "scatter":
        return (
          <div className="relative w-full h-full">
            {/* Scatter plot dots */}
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  left: `${Math.random() * 80 + 10}%`,
                  top: `${Math.random() * 70 + 15}%`
                }}
              />
            ))}
          </div>
        );
      case "quadrant":
        return (
          <div className="relative w-full h-full">
            {/* Quadrant grid */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton
                      key={j}
                      className="w-2 h-2 rounded-full m-2"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      case "bar":
        return (
          <div className="flex items-end justify-around h-full space-x-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton
                key={i}
                className="w-8"
                style={{ height: `${Math.random() * 60 + 20}%` }}
              />
            ))}
          </div>
        );
      default:
        return <Skeleton className="w-full h-full" />;
    }
  };

  return (
    <div className={cn("animate-pulse", className)}>
      <div className={cn("relative", heightClasses[height])}>
        {/* Chart background */}
        <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          {renderChartContent()}
        </div>
        
        {/* Axes */}
        {showAxes && (
          <>
            {/* Y-axis */}
            <div className="absolute left-2 top-4 bottom-4 flex flex-col justify-between">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="w-8 h-3" />
              ))}
            </div>
            {/* X-axis */}
            <div className="absolute bottom-2 left-12 right-4 flex justify-between">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="w-12 h-3" />
              ))}
            </div>
          </>
        )}
      </div>
      
      {/* Legend */}
      {showLegend && (
        <div className="mt-4 flex flex-wrap gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Skeleton className="w-3 h-3 rounded-full" />
              <Skeleton className="w-16 h-4" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}