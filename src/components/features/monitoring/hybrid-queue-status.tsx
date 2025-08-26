import { useState, useEffect } from 'react'
import { Zap, GitBranch, Database, Clock, CheckCircle, XCircle, Loader2, RefreshCw, Activity } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { HybridQueueManager } from '@/lib/progressive-capture/hybrid-queue-manager';
import { cn } from '@/lib/utils';

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface HybridStats {
  inngest: QueueStats;
  github_actions: QueueStats;
  total: QueueStats;
}

interface HybridQueueStatusProps {
  className?: string;
  showTabs?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function HybridQueueStatus({ 
  className,
  showTabs = true,
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}: HybridQueueStatusProps) {
  const [stats, setStats] = useState<HybridStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStats = async () => {
    try {
      const hybridManager = new HybridQueueManager();
      const hybridStats = await hybridManager.getHybridStats();
      setStats(hybridStats);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch hybrid queue stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch queue stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    if (autoRefresh) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const calculateSuccessRate = (stats: QueueStats): number => {
    const total = stats.completed + stats.failed;
    return total > 0 ? (stats.completed / total) * 100 : 0;
  };

  const getStatusColor = (status: keyof QueueStats): string => {
    switch (_status) {
      case 'pending': return 'text-yellow-600';
      case 'processing': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: keyof QueueStats) => {
    switch (_status) {
      case 'pending': return Clock;
      case 'processing': return Loader2;
      case 'completed': return CheckCircle;
      case 'failed': return XCircle;
      default: return Activity;
    }
  };

  const QueueStatsCard = ({ 
    title, 
    stats: queueStats, 
    icon: Icon, 
    iconColor,
    processor 
  }: {
    title: string;
    stats: QueueStats;
    icon: React.ComponentType<any>;
    iconColor: string;
    processor: 'inngest' | 'github_actions' | 'total';
  }) => {
    const successRate = calculateSuccessRate(queueStats);
    const totalJobs = queueStats.pending + queueStats.processing + queueStats.completed + queueStats.failed;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", iconColor)} />
            {title}
            {processor !== 'total' && (
              <Badge variant="secondary" className="ml-auto">
                {processor === 'inngest' ? 'Real-time' : 'Bulk'}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {processor === 'inngest' && 'Immediate processing for recent data'}
            {processor === 'github_actions' && 'Background processing for historical data'}
            {processor === 'total' && 'Combined statistics from both processors'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Summary Numbers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{totalJobs}</div>
              <div className="text-xs text-muted-foreground">Total Jobs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{successRate.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="space-y-2">
            {Object.entries(queueStats).map(([status, count]) => {
              const StatusIcon = getStatusIcon(status as keyof QueueStats);
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={cn("h-4 w-4", getStatusColor(status as keyof QueueStats))} />
                    <span className="text-sm capitalize">{status}</span>
                  </div>
                  <Badge variant="outline">{count}</Badge>
                </div>
              );
            })}
          </div>

          {/* Success Rate Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Success Rate</span>
              <span>{successRate.toFixed(1)}%</span>
            </div>
            <Progress 
              value={successRate} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Queue Status
            <Loader2 className="h-4 w-4 animate-spin ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading queue statistics...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (_error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Queue Status
            <XCircle className="h-4 w-4 text-red-500 ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={fetchStats} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const content = showTabs
? (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="inngest">Real-time</TabsTrigger>
        <TabsTrigger value="actions">Bulk</TabsTrigger>
        <TabsTrigger value="comparison">Compare</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        <QueueStatsCard
          title="Total Queue Status"
          stats={stats.total}
          icon={Database}
          iconColor="text-gray-600"
          processor="total"
        />
      </TabsContent>

      <TabsContent value="inngest" className="space-y-4">
        <QueueStatsCard
          title="Inngest Queue"
          stats={stats.inngest}
          icon={Zap}
          iconColor="text-blue-600"
          processor="inngest"
        />
      </TabsContent>

      <TabsContent value="actions" className="space-y-4">
        <QueueStatsCard
          title="GitHub Actions Queue"
          stats={stats.github_actions}
          icon={GitBranch}
          iconColor="text-purple-600"
          processor="github_actions"
        />
      </TabsContent>

      <TabsContent value="comparison" className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QueueStatsCard
            title="Inngest (Real-time)"
            stats={stats.inngest}
            icon={Zap}
            iconColor="text-blue-600"
            processor="inngest"
          />
          <QueueStatsCard
            title="GitHub Actions (Bulk)"
            stats={stats.github_actions}
            icon={GitBranch}
            iconColor="text-purple-600"
            processor="github_actions"
          />
        </div>
      </TabsContent>
    </Tabs>
  )
: (
    <QueueStatsCard
      title="Queue Status"
      stats={stats.total}
      icon={Database}
      iconColor="text-gray-600"
      processor="total"
    />
  );

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Hybrid Queue Status
              <Badge variant="outline" className="ml-2">
                Live
              </Badge>
            </CardTitle>
            <CardDescription>
              Real-time monitoring of Inngest and GitHub Actions job queues
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
            <Button onClick={fetchStats} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}

export { type HybridStats, type QueueStats };