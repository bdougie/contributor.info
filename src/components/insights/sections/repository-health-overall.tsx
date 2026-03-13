import { useMemo } from 'react';
import { Heart, TrendingUp, TrendingDown, Minus } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { calculateHealthMetricsFromStats } from '@/lib/insights/health-metrics';
import type { HealthMetrics } from '@/lib/insights/health-metrics';
import type { RepoStats } from '@/lib/types';

interface RepositoryHealthOverallProps {
  stats: RepoStats;
  timeRange: string;
}

export function RepositoryHealthOverall({ stats, timeRange }: RepositoryHealthOverallProps) {
  const health = useMemo(() => {
    if (stats.loading || stats.error || stats.pullRequests.length === 0) {
      return null;
    }
    return calculateHealthMetricsFromStats(stats, timeRange);
  }, [stats, timeRange]);

  const loading = stats.loading;

  const getTrendIcon = (trend: HealthMetrics['trend']) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (loading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!health) {
    return (
      <Card className="p-4">
        <div className="text-center py-2">
          <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Health data unavailable</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium">Overall Health</h4>
        <div className="flex items-center gap-2">
          {getTrendIcon(health.trend)}
          <span className="text-xs text-muted-foreground capitalize">{health.trend}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <span className={cn('text-4xl font-bold', getScoreColor(health.score))}>
            {health.score}
          </span>
          <span className="text-lg text-muted-foreground mb-1">/100</span>
        </div>

        <Progress value={health.score} className="h-3" />

        <p className="text-xs text-muted-foreground">
          Last updated {new Date(health.lastChecked).toLocaleTimeString()}
        </p>
      </div>
    </Card>
  );
}
