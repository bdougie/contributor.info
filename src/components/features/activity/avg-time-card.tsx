import { Clock, TrendingUp, TrendingDown, Minus } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface AvgTimeCardProps {
  averageMergeTime: number;
  averageMergeTimeTrend?: 'up' | 'down' | 'stable';
  loading?: boolean;
}

export function AvgTimeCard({
  averageMergeTime,
  averageMergeTimeTrend,
  loading,
}: AvgTimeCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  let mergeTimeColor: string;
  if (averageMergeTime <= 24) {
    mergeTimeColor = 'text-green-500';
  } else if (averageMergeTime <= 72) {
    mergeTimeColor = 'text-yellow-500';
  } else {
    mergeTimeColor = 'text-red-500';
  }

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">Avg Time to Merge</span>
      </div>
      <p className={cn('text-2xl font-bold mt-2 truncate', mergeTimeColor)}>
        {averageMergeTime < 24
          ? `${Math.round(averageMergeTime)}hrs`
          : `${(averageMergeTime / 24).toFixed(1)}d`}
      </p>
      <div className="flex items-center gap-1">
        {(() => {
          if (averageMergeTime <= 24) {
            if (averageMergeTimeTrend === 'down') {
              return <TrendingDown className="h-3 w-3 text-green-500" />;
            } else if (averageMergeTimeTrend === 'up') {
              return <TrendingUp className="h-3 w-3 text-red-500" />;
            }
            return null;
          } else if (averageMergeTime <= 72) {
            return <Minus className="h-3 w-3 text-muted-foreground" />;
          } else {
            if (averageMergeTimeTrend === 'down') {
              return <TrendingDown className="h-3 w-3 text-green-500" />;
            } else if (averageMergeTimeTrend === 'up') {
              return <TrendingUp className="h-3 w-3 text-red-500" />;
            }
            return null;
          }
        })()}
        <span
          className={cn(
            'text-xs font-medium',
            (() => {
              if (averageMergeTime <= 24) return 'text-green-500';
              if (averageMergeTime <= 72) return 'text-muted-foreground';
              return 'text-red-500';
            })()
          )}
        >
          {(() => {
            if (averageMergeTime <= 24) return 'Fast';
            if (averageMergeTime <= 72) return 'Normal';
            return 'Slow';
          })()}
        </span>
      </div>
    </Card>
  );
}
