import { useState, useEffect } from 'react'
import { GitBranch, ExternalLink, CheckCircle, XCircle, Clock, Loader2, RefreshCw, Activity } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface WorkflowRun {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'cancelled' | 'failure';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  repository: string;
  workflow_name: string;
  run_number: number;
}

interface GitHubActionsMonitorProps {
  className?: string;
  showAll?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function GitHubActionsMonitor({ 
  className,
  showAll = false,
  autoRefresh = true,
  refreshInterval = 60000 // 1 minute
}: GitHubActionsMonitorProps) {
  const [workflows, setWorkflows] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchWorkflows = async () => {
    try {
      // In a real implementation, this would fetch from GitHub Actions API
      // For now, we'll simulate with mock data based on progressive capture jobs
      const mockWorkflows: WorkflowRun[] = [
        {
          id: '1',
          name: 'Historical PR Sync',
          status: 'in_progress',
          conclusion: null,
          created_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
          updated_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
          html_url: 'https://github.com/bdougie/jobs/actions/runs/123456',
          repository: 'contributor.info',
          workflow_name: 'Bulk Capture',
          run_number: 42
        },
        {
          id: '2',
          name: 'PR Reviews Capture',
          status: 'completed',
          conclusion: 'success',
          created_at: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
          updated_at: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
          html_url: 'https://github.com/bdougie/jobs/actions/runs/123455',
          repository: 'react',
          workflow_name: 'Historical PR Sync',
          run_number: 41
        }
      ];

      setWorkflows(showAll ? mockWorkflows : mockWorkflows.slice(0, 3));
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch GitHub Actions workflows:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();

    if (autoRefresh) {
      const interval = setInterval(fetchWorkflows, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, showAll]);

  const getStatusIcon = (status: string, conclusion: string | null) => {
    if (status === 'completed') {
      if (conclusion === 'success') return CheckCircle;
      if (conclusion === 'failure') return XCircle;
      if (conclusion === 'cancelled') return XCircle;
    }
    if (status === 'in_progress') return Loader2;
    if (status === 'queued') return Clock;
    return Activity;
  };

  const getStatusColor = (status: string, conclusion: string | null) => {
    if (status === 'completed') {
      if (conclusion === 'success') return 'text-green-600';
      if (conclusion === 'failure') return 'text-red-600';
      if (conclusion === 'cancelled') return 'text-gray-600';
    }
    if (status === 'in_progress') return 'text-blue-600';
    if (status === 'queued') return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getStatusBadge = (status: string, conclusion: string | null) => {
    if (status === 'completed') {
      if (conclusion === 'success') return { text: 'Success', variant: 'default' as const };
      if (conclusion === 'failure') return { text: 'Failed', variant: 'destructive' as const };
      if (conclusion === 'cancelled') return { text: 'Cancelled', variant: 'secondary' as const };
    }
    if (status === 'in_progress') return { text: 'Running', variant: 'default' as const };
    if (status === 'queued') return { text: 'Queued', variant: 'secondary' as const };
    return { text: 'Unknown', variant: 'secondary' as const };
  };

  const calculateProgress = (workflow: WorkflowRun) => {
    if (workflow.status === 'completed') return 100;
    if (workflow.status === 'in_progress') {
      // Estimate progress based on time elapsed (rough approximation)
      const elapsed = Date.now() - new Date(workflow.created_at).getTime();
      const estimatedTotal = 10 * 60 * 1000; // 10 minutes estimated
      return Math.min((elapsed / estimatedTotal) * 100, 95);
    }
    return 0;
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.round(duration / 60)}m`;
    return `${Math.round(duration / 3600)}h`;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            GitHub Actions
            <Loader2 className="h-4 w-4 animate-spin ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading workflow status...
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
            <GitBranch className="h-5 w-5" />
            GitHub Actions
            <XCircle className="h-4 w-4 text-red-500 ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">{error: _error}</p>
            <Button onClick={fetchWorkflows} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              GitHub Actions
              <Badge variant="outline" className="ml-2">
                {workflows.length} workflows
              </Badge>
            </CardTitle>
            <CardDescription>
              Bulk processing workflows for historical data capture
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
            <Button onClick={fetchWorkflows} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {workflows.length === 0
? (
          <div className="text-center py-8 text-muted-foreground">
            No active workflows
          </div>
        )
: (
          <div className="space-y-4">
            {workflows.map((workflow) => {
              const StatusIcon = getStatusIcon(workflow.status, workflow.conclusion);
              const statusColor = getStatusColor(workflow.status, workflow.conclusion);
              const statusBadge = getStatusBadge(workflow.status, workflow.conclusion);
              const progress = calculateProgress(workflow);

              return (
                <div key={workflow.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={cn("h-4 w-4", statusColor, {
                        'animate-spin': workflow.status === 'in_progress'
                      })} />
                      <span className="font-medium">{workflow.workflow_name}</span>
                      <Badge variant={statusBadge.variant} className="text-xs">
                        {statusBadge.text}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        #{workflow.run_number}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => window.open(workflow.html_url, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Repository: {workflow.repository}</span>
                      <span>Duration: {formatDuration(workflow.created_at, workflow.updated_at)}</span>
                    </div>
                    
                    {workflow.status === 'in_progress' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Progress</span>
                          <span>{Math.round(progress)}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Started {new Date(workflow.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { type WorkflowRun };