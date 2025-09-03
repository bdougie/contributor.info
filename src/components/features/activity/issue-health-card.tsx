import { AlertCircle, Clock } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface IssueHealthCardProps {
  staleCount: number;
  activeCount: number;
  stalePercentage: number;
  loading?: boolean;
}

export function IssueHealthCard({
  staleCount,
  activeCount,
  stalePercentage,
  loading,
}: IssueHealthCardProps) {
  if (loading) {
    return (
      <Card className="p-3 min-w-0">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  const getHealthStatus = (percentage: number) => {
    if (percentage <= 20) return { color: 'text-green-500', label: 'Healthy' };
    if (percentage <= 50) return { color: 'text-yellow-500', label: 'Moderate' };
    return { color: 'text-red-500', label: 'Needs Attention' };
  };

  const health = getHealthStatus(stalePercentage);

  return (
    <Card className="p-3 min-w-0">
      <div className="flex items-center justify-between">
        <AlertCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-xs text-muted-foreground truncate">Issue Health</h3>
      </div>
      <dl className="mt-2">
        <dt className="sr-only">Stale Percentage</dt>
        <dd className="text-2xl font-bold truncate">{stalePercentage}%</dd>
        <div className="flex items-center gap-1 mt-1">
          <Badge variant="secondary" className={`text-xs ${health.color}`}>
            {health.label}
          </Badge>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          <dt className="sr-only">Issue Breakdown</dt>
          <dd className="text-xs text-muted-foreground truncate">
            {staleCount} stale, {activeCount} active
          </dd>
        </div>
      </dl>
    </Card>
  );
}
