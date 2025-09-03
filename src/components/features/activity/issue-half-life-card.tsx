import { Clock, TrendingDown, TrendingUp } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface IssueHalfLifeCardProps {
  halfLife: number;
  trend?: 'up' | 'down' | 'stable';
  loading?: boolean;
}

export function IssueHalfLifeCard({ halfLife, trend = 'stable', loading }: IssueHalfLifeCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  const formatTime = (days: number) => {
    if (days === 0) return '0d';
    if (days < 1) return `${Math.round(days * 24)}hrs`;
    if (days < 7) return `${Math.round(days)}d`;
    if (days < 30) return `${Math.round(days / 7)}w`;
    return `${Math.round(days / 30)}mo`;
  };

  const getTimeColor = (days: number) => {
    if (days <= 7) return 'text-green-500';
    if (days <= 30) return 'text-yellow-500';
    return 'text-red-500';
  };

  const timeColor = getTimeColor(halfLife);

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">Issue Half-life</span>
      </div>
      <p className={cn('text-2xl font-bold mt-2 truncate', timeColor)}>{formatTime(halfLife)}</p>
      <div className="flex items-center gap-1">
        {trend === 'down' && <TrendingDown className="h-3 w-3 text-green-500" />}
        {trend === 'up' && <TrendingUp className="h-3 w-3 text-red-500" />}
        <p className="text-xs text-muted-foreground truncate">to resolve</p>
      </div>
    </Card>
  );
}
