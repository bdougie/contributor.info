import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";

export interface MetricCardProps {
  title: string;
  subtitle?: string;
  value: number | string;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label?: string;
  };
  loading?: boolean;
  className?: string;
  format?: "number" | "percentage" | "compact";
  color?: "blue" | "green" | "orange" | "purple" | "gray";
}

const colorMap = {
  blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950",
  green: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950",
  orange: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950",
  purple: "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950",
  gray: "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950",
};

export function MetricCard({
  title,
  subtitle,
  value,
  description,
  icon,
  trend,
  loading = false,
  className,
  format = "number",
  color = "blue",
}: MetricCardProps) {
  const formatValue = (val: number | string): string => {
    if (typeof val === "string") return val;
    
    switch (format) {
      case "percentage":
        return `${val}%`;
      case "compact":
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return val.toString();
      default:
        return val.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    
    if (trend.value > 0) {
      return <TrendingUp className="h-4 w-4" />;
    } else if (trend.value < 0) {
      return <TrendingDown className="h-4 w-4" />;
    } else {
      return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return "";
    
    if (trend.value > 0) {
      return "text-green-600 dark:text-green-400";
    } else if (trend.value < 0) {
      return "text-red-600 dark:text-red-400";
    } else {
      return "text-gray-600 dark:text-gray-400";
    }
  };

  if (loading) {
    return (
      <Card className={cn("transition-all hover:shadow-md", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("transition-all hover:shadow-md", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {icon && (
            <div className={cn("p-2 rounded", colorMap[color])}>
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold">
              {formatValue(value)}
            </div>
            {trend && (
              <div className={cn("flex items-center gap-1", getTrendColor())}>
                {getTrendIcon()}
                <span className="text-sm font-medium">
                  {Math.abs(trend.value)}%
                </span>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">
                    {trend.label}
                  </span>
                )}
              </div>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Export a skeleton component for easier usage
export function MetricCardSkeleton({ className }: { className?: string }) {
  return <MetricCard title="" value="" loading={true} className={className} />;
}