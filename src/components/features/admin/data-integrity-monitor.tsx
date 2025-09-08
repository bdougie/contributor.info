import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, Database, Clock, TrendingUp } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';

interface ConsistencyIssue {
  repository_name: string;
  stored_pull_request_count: number;
  stored_total_pull_requests: number;
  actual_pr_count: number;
  count_difference: number;
  consistency_status: string;
}

interface ConsistencyCheck {
  id: string;
  check_type: string;
  status: string;
  details: any;
  checked_at: string;
  fixed_at?: string;
}

interface SyncMetrics {
  total_syncs: number;
  successful_syncs: number;
  failed_syncs: number;
  timeouts: number;
  avg_execution_time: number;
  max_execution_time?: number;
  supabase_usage: number;
  netlify_usage: number;
}

export function DataIntegrityMonitor() {
  const [loading, setLoading] = useState(true);
  const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[]>([]);
  const [recentChecks, setRecentChecks] = useState<ConsistencyCheck[]>([]);
  const [syncMetrics, setSyncMetrics] = useState<SyncMetrics | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      setRefreshing(true);

      // Fetch consistency issues
      const { data: issues, error: issuesError } = await supabase
        .rpc('check_repository_pr_count_consistency');

      if (issuesError) throw issuesError;
      setConsistencyIssues(issues || []);

      // Fetch recent consistency checks
      const { data: checks, error: checksError } = await supabase
        .from('data_consistency_checks')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(10);

      if (checksError) throw checksError;
      setRecentChecks(checks || []);

      // Fetch sync metrics for the last 7 days
      const { data: metrics, error: metricsError } = await supabase
        .rpc('get_sync_statistics', { days_back: 7 });

      if (metricsError) throw metricsError;
      setSyncMetrics(metrics?.[0] || null);

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runConsistencyCheck = async () => {
    try {
      setRefreshing(true);
      
      // Trigger a new consistency check
      const { error } = await supabase.rpc('run_data_consistency_checks');
      
      if (error) throw error;
      
      // Refresh the data
      await fetchData();
    } catch (error) {
      console.error('Failed to run consistency check:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const fixConsistencyIssues = async () => {
    try {
      setRefreshing(true);
      
      // Trigger automatic fix
      const { error } = await supabase.rpc('fix_repository_pr_count_inconsistencies');
      
      if (error) throw error;
      
      // Refresh the data
      await fetchData();
    } catch (error) {
      console.error('Failed to fix consistency issues:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'consistent':
        return 'text-green-600 bg-green-50';
      case 'inconsistent':
        return 'text-red-600 bg-red-50';
      case 'fixed':
        return 'text-blue-600 bg-blue-50';
      case 'failed':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getConsistencyStatusColor = (status: string) => {
    switch (status) {
      case 'CONSISTENT':
        return 'bg-green-100 text-green-800';
      case 'PR_COUNT_MISMATCH':
      case 'TOTAL_PR_MISMATCH':
      case 'INCONSISTENT':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Integrity Monitor</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of database consistency and sync operations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={fetchData} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data Consistency</p>
                <p className="text-2xl font-bold">
                  {consistencyIssues.length === 0 ? 'Good' : `${consistencyIssues.length} Issues`}
                </p>
              </div>
              {consistencyIssues.length === 0 ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sync Success Rate</p>
                <p className="text-2xl font-bold">
                  {syncMetrics 
                    ? `${Math.round((syncMetrics.successful_syncs / syncMetrics.total_syncs) * 100)}%`
                    : 'N/A'
                  }
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Sync Time</p>
                <p className="text-2xl font-bold">
                  {syncMetrics 
                    ? `${syncMetrics.avg_execution_time.toFixed(1)}s`
                    : 'N/A'
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Consistency Issues */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Consistency Issues
              </CardTitle>
              <CardDescription>
                Repositories with mismatched PR counts between stored values and actual data
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={runConsistencyCheck} disabled={refreshing} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Check Now
              </Button>
              {consistencyIssues.length > 0 && (
                <Button onClick={fixConsistencyIssues} disabled={refreshing} size="sm">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Auto-Fix Issues
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {consistencyIssues.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All repository PR counts are consistent. No issues detected.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Found {consistencyIssues.length} repositories with inconsistent PR counts. 
                  This can cause charts to display incorrect data.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                {consistencyIssues.slice(0, 10).map((issue, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{issue.repository_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Stored: {issue.stored_pull_request_count} / {issue.stored_total_pull_requests} | 
                        Actual: {issue.actual_pr_count} | 
                        Difference: {Math.abs(issue.count_difference)}
                      </div>
                    </div>
                    <Badge className={getConsistencyStatusColor(issue.consistency_status)}>
                      {issue.consistency_status}
                    </Badge>
                  </div>
                ))}
                {consistencyIssues.length > 10 && (
                  <p className="text-sm text-muted-foreground text-center">
                    ... and {consistencyIssues.length - 10} more issues
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Consistency Checks */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Consistency Checks</CardTitle>
            <CardDescription>
              History of automated and manual data consistency checks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentChecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent checks recorded</p>
              ) : (
                recentChecks.map((check) => (
                  <div key={check.id} className="flex items-center justify-between p-2 rounded border">
                    <div>
                      <div className="text-sm font-medium">{check.check_type}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(check.checked_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {check.fixed_at && (
                        <Badge variant="outline" className="text-xs">
                          Fixed: {new Date(check.fixed_at).toLocaleTimeString()}
                        </Badge>
                      )}
                      <Badge className={getStatusColor(check.status)}>
                        {check.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sync Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Performance (Last 7 Days)</CardTitle>
            <CardDescription>
              Performance metrics for GitHub data synchronization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {syncMetrics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Syncs</div>
                    <div className="text-2xl font-bold">{syncMetrics.total_syncs}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                    <div className="text-2xl font-bold">
                      {Math.round((syncMetrics.successful_syncs / syncMetrics.total_syncs) * 100)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                    <div className="text-2xl font-bold text-red-600">{syncMetrics.failed_syncs}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Timeouts</div>
                    <div className="text-2xl font-bold text-orange-600">{syncMetrics.timeouts}</div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="text-sm text-muted-foreground mb-2">Execution Time</div>
                  <div className="flex justify-between">
                    <span>Average: {syncMetrics.avg_execution_time.toFixed(1)}s</span>
                    {syncMetrics.max_execution_time && (
                      <span>Max: {syncMetrics.max_execution_time.toFixed(1)}s</span>
                    )}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="text-sm text-muted-foreground mb-2">Router Usage</div>
                  <div className="flex justify-between">
                    <span>Supabase: {syncMetrics.supabase_usage}</span>
                    <span>Netlify: {syncMetrics.netlify_usage}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sync metrics available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}