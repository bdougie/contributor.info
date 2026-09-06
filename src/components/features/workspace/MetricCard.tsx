import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Info } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  format?: 'number' | 'percentage' | 'compact' | ((val: number) => string);
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'gray' | 'yellow';
  layout?: 'default' | 'inline';
}

const colorMap = {
  blue: 'text-blue-600 dark:text-blue-400',
  green: 'text-emerald-600 dark:text-emerald-400',
  orange: 'text-orange-600 dark:text-orange-400',
  purple: 'text-purple-600 dark:text-purple-400',
  gray: 'text-muted-foreground',
  yellow: 'text-amber-600 dark:text-amber-400',
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
  format = 'number',
  color = 'blue',
  layout = 'default',
}: MetricCardProps) {
  const inline = layout === 'inline';
  const cardClassName = cn(
    'min-w-0 p-4 shadow-none sm:p-5',
    inline && 'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-muted/20',
    className
  );

  const formatValue = (val: number | string): string => {
    if (typeof val === 'string') return val;

    // If format is a function, use it
    if (typeof format === 'function') {
      return format(val);
    }

    switch (format) {
      case 'percentage':
        return `${val}%`;
      case 'compact':
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
      return <TrendingUp className="h-3 w-3" />;
    } else if (trend.value < 0) {
      return <TrendingDown className="h-3 w-3" />;
    } else {
      return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return '';

    if (trend.value > 0) {
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    } else if (trend.value < 0) {
      return 'bg-rose-500/10 text-rose-700 dark:text-rose-400';
    } else {
      return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card className={cardClassName} aria-busy="true" aria-label={`Loading ${title}`}>
        <div className={cn('space-y-3', inline && 'flex-1')}>
          <Skeleton className="h-5 w-32 max-w-full" />
          {inline && <Skeleton className="h-4 w-64 max-w-full" />}
        </div>
        <div className={cn('space-y-3', !inline && 'mt-3')}>
          <Skeleton className="h-9 w-24 max-w-full" />
          {!inline && <Skeleton className="h-5 w-20" />}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cardClassName}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon && <span className={cn('inline-flex shrink-0', colorMap[color])}>{icon}</span>}
          <CardTitle className="text-sm font-medium leading-5 tracking-normal text-muted-foreground">
            {title}
          </CardTitle>
          {description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`About ${title}`}
                  className="-my-1 ml-auto inline-flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {inline && subtitle && <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className={cn('min-w-0', !inline && 'mt-3')}>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <div
            className={cn(
              'break-all text-3xl font-semibold tracking-tight tabular-nums',
              inline && 'text-2xl'
            )}
          >
            {formatValue(value)}
          </div>
          {!inline && subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {trend && (
          <div
            className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', inline ? 'mt-1' : 'mt-3')}
          >
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums',
                getTrendColor()
              )}
            >
              {getTrendIcon()}
              {trend.value !== 0 && (
                <span className="sr-only">{trend.value > 0 ? 'Up ' : 'Down '}</span>
              )}
              {trend.value === 0
                ? 'No change'
                : `${Math.abs(trend.value).toLocaleString(undefined, { maximumFractionDigits: Math.abs(trend.value) < 1 ? 2 : 0 })}%`}
            </span>
            {trend.label && <span className="text-xs text-muted-foreground">{trend.label}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}

// Export a skeleton component for easier usage
export function MetricCardSkeleton({ className }: { className?: string }) {
  return <MetricCard title="" value="" loading={true} className={className} />;
}
