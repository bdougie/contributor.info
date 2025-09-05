import { } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Star, 
  GitFork, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  Calendar,
  BarChart3
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useWorkspaceEvents } from '@/hooks/use-workspace-events';
import type { EventTrendMetrics } from '@/services/workspace-events.service';

interface WorkspaceEventsMetricsProps {
  workspaceId: string;
  timeRange?: string;
}

interface EventMetricCardProps {
  title: string;
  icon: React.ReactNode;
  metrics: EventTrendMetrics;
  loading?: boolean;
}

function EventMetricCard({ title, icon, metrics, loading = false }: EventMetricCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: string, percentChange: number) => {
    if (trend === 'stable' || percentChange === 0) return null;

    const isPositive = percentChange > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? 'text-green-500' : 'text-red-500';

    return <Icon className={cn('h-4 w-4', color)} />;
  };

  const getTrendColor = (percentChange: number) => {
    if (percentChange > 0) return 'text-green-500';
    if (percentChange < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {icon}
            <h4 className="text-sm font-medium">{title}</h4>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{metrics.total}</span>
              <span className="text-sm text-muted-foreground">total</span>
              
              <div className="flex items-center gap-1 ml-auto">
                {getTrendIcon(metrics.trend, metrics.percentChange)}
                <span className={cn('text-sm font-medium', getTrendColor(metrics.percentChange))}>
                  {metrics.percentChange > 0 ? '+' : ''}
                  {metrics.percentChange}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">This week: </span>
                <span className="font-medium">{metrics.thisWeek}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Last week: </span>
                <span className="font-medium">{metrics.lastWeek}</span>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {metrics.velocity.toFixed(1)}/day avg
                </span>
              </div>
            </div>
          </div>

          <Badge variant="secondary" className="text-xs">
            vs previous period
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivitySummaryCard({ metrics, loading = false }: { 
  metrics: {
    totalEvents: number;
    uniqueActors: number;
    mostActiveRepo: { owner: string; name: string; eventCount: number } | null;
    activityScore: number;
  }; 
  loading?: boolean; 
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Activity Summary</h4>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Events</span>
              <span className="text-lg font-bold">{metrics.totalEvents}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Contributors</span>
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium">{metrics.uniqueActors}</span>
              </div>
            </div>

            {metrics.mostActiveRepo && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Most Active</p>
                <p className="text-sm font-medium">
                  {metrics.mostActiveRepo.owner}/{metrics.mostActiveRepo.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.mostActiveRepo.eventCount} events
                </p>
              </div>
            )}

            <div className="pt-1">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  (() => {
                    if (metrics.activityScore > 70) return 'bg-green-500';
                    if (metrics.activityScore > 40) return 'bg-yellow-500';
                    return 'bg-red-500';
                  })()
                )} />
                <span className="text-xs text-muted-foreground">
                  Activity Score: {metrics.activityScore}/100
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkspaceEventsMetrics({ 
  workspaceId, 
  timeRange = '30d' 
}: WorkspaceEventsMetricsProps) {
  const { metrics, loading, error, refetch } = useWorkspaceEvents({
    workspaceId,
    timeRange,
    enabled: !!workspaceId
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Events Analytics</CardTitle>
          <CardDescription>
            Real-time insights from GitHub activity events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              Failed to load events data
            </p>
            <Button variant="outline" onClick={refetch} size="sm">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Events Analytics</CardTitle>
          <CardDescription>
            No event data available for this time period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Event tracking will appear here once repositories have activity
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Events Analytics</CardTitle>
            <CardDescription>
              Real-time insights from GitHub activity events over {timeRange}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Event Metrics Cards */}
        <section>
          <h3 className="text-sm font-medium mb-3">Event Metrics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <EventMetricCard
              title="Stars"
              icon={<Star className="h-4 w-4 text-yellow-500" />}
              metrics={metrics?.stars || {
                total: 0,
                thisWeek: 0,
                lastWeek: 0,
                thisMonth: 0,
                lastMonth: 0,
                velocity: 0,
                trend: 'stable' as const,
                percentChange: 0
              }}
              loading={loading}
            />
            
            <EventMetricCard
              title="Forks"
              icon={<GitFork className="h-4 w-4 text-blue-500" />}
              metrics={metrics?.forks || {
                total: 0,
                thisWeek: 0,
                lastWeek: 0,
                thisMonth: 0,
                lastMonth: 0,
                velocity: 0,
                trend: 'stable' as const,
                percentChange: 0
              }}
              loading={loading}
            />

            <ActivitySummaryCard 
              metrics={metrics?.activity || {
                totalEvents: 0,
                uniqueActors: 0,
                mostActiveRepo: null,
                activityScore: 0
              }}
              loading={loading} 
            />
          </div>
        </section>

        {/* Timeline Preview */}
        {metrics?.timeline && metrics.timeline.length > 0 && (
          <section>
            <h3 className="text-sm font-medium mb-3">Activity Timeline</h3>
            <div className="text-sm text-muted-foreground">
              {metrics.timeline.length} days of activity data available
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}