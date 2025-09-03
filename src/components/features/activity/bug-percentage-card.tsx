import { Bug, TrendingUp, TrendingDown } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BugPercentageCardProps {
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
  loading?: boolean;
}

export function BugPercentageCard({
  percentage,
  trend = 'stable',
  loading,
}: BugPercentageCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (trend === 'up')
      return <TrendingUp className="h-3 w-3 text-yellow-500" aria-hidden="true" />;
    if (trend === 'down')
      return <TrendingDown className="h-3 w-3 text-green-500" aria-hidden="true" />;
    return null;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-yellow-500'; // More bugs might be concerning
    if (trend === 'down') return 'text-green-500'; // Fewer bugs is good
    return 'text-muted-foreground';
  };

  const getBugLevel = (percent: number) => {
    if (percent >= 60) return { label: 'High', color: 'text-red-500' };
    if (percent >= 30) return { label: 'Moderate', color: 'text-yellow-500' };
    return { label: 'Low', color: 'text-green-500' };
  };

  const bugLevel = getBugLevel(percentage);

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <Bug className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-xs text-muted-foreground truncate">Bug Reports</h3>
      </div>
      <dl className="mt-2">
        <dt className="sr-only">Bug Percentage</dt>
        <dd className="text-2xl font-bold truncate">{percentage}%</dd>
        <div className="flex items-center gap-1 mt-1">
          <Badge variant="secondary" className={`text-xs ${bugLevel.color}`}>
            {bugLevel.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {getTrendIcon()}
          <dt className="sr-only">Bug Trend</dt>
          <dd className={cn('text-xs truncate', getTrendColor())}>
            {trend === 'up' && 'More bugs reported'}
            {trend === 'down' && 'Fewer bugs reported'}
            {trend === 'stable' && 'Stable bug rate'}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
