import { useMemo } from 'react';
import { Heart } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ShareableCard } from '@/components/features/sharing/shareable-card';
import { calculateHealthMetricsFromStats } from '@/lib/insights/health-metrics';
import type { RepoStats } from '@/lib/types';

interface RepositoryHealthFactorsProps {
  stats: RepoStats;
  timeRange: string;
  repositoryName?: string;
}

export function RepositoryHealthFactors({
  stats,
  timeRange,
  repositoryName,
}: RepositoryHealthFactorsProps) {
  const health = useMemo(() => {
    if (stats.loading || stats.error || stats.pullRequests.length === 0) {
      return null;
    }
    return calculateHealthMetricsFromStats(stats, timeRange);
  }, [stats, timeRange]);

  const loading = stats.loading;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!health) {
    return (
      <Card className="p-4">
        <div className="text-center py-2">
          <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Health factors unavailable</p>
        </div>
      </Card>
    );
  }

  return (
    <ShareableCard
      title="Health Factors"
      contextInfo={{
        repository: repositoryName,
        metric: 'health factors',
      }}
      chartType="health-factors"
    >
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Health Factors</h4>
        <div className="space-y-3">
          {health.factors.map((factor) => (
            <div key={factor.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('h-2 w-2 rounded-full', getStatusColor(factor.status))} />
                  <span className="text-sm">{factor.name}</span>
                </div>
                <span className={cn('text-sm font-medium', getScoreColor(factor.score))}>
                  {Math.round(factor.score)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-4">{factor.description}</p>
              <Progress value={factor.score} className="h-1.5" />
            </div>
          ))}
        </div>
      </Card>
    </ShareableCard>
  );
}
