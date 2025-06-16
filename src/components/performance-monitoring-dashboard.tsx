import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Database, Globe, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { githubAPIMonitoring } from '@/lib/github-api-monitoring';

interface DatabaseMetrics {
  slowQueries: number;
  totalConnections: number;
  maxConnections: number;
  connectionUtilization: number;
  cacheHitRatio: number;
  databaseSize: string;
  unresolved_alerts: number;
}

interface PerformanceAlert {
  id: string;
  alert_type: string;
  severity: 'warning' | 'critical';
  metric_value: number;
  threshold_value: number;
  created_at: string;
  details?: any;
}

export function PerformanceMonitoringDashboard() {
  const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      
      // Load database metrics
      const [
        slowQueriesResult,
        connectionStatusResult,
        databaseSizeResult,
        alertsResult
      ] = await Promise.all([
        supabase.from('slow_queries').select('*'),
        supabase.rpc('get_connection_pool_status'),
        supabase.rpc('get_database_size_stats'),
        supabase.from('query_performance_alerts')
          .select('*')
          .is('resolved_at', null)
          .order('created_at', { ascending: false })
          .limit(10)
      ]);

      // Process database metrics
      const connectionStatus = connectionStatusResult.data?.[0];
      const sizeStats = databaseSizeResult.data?.[0];
      
      setDatabaseMetrics({
        slowQueries: slowQueriesResult.data?.length || 0,
        totalConnections: connectionStatus?.total_connections || 0,
        maxConnections: connectionStatus?.max_connections || 100,
        connectionUtilization: connectionStatus?.connection_utilization_percent || 0,
        cacheHitRatio: 95, // This would come from actual cache metrics
        databaseSize: sizeStats?.size_pretty || 'Unknown',
        unresolved_alerts: alertsResult.data?.length || 0,
      });

      setAlerts(alertsResult.data || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading performance metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPerformanceSnapshot = async () => {
    try {
      await supabase.rpc('create_performance_snapshot');
      await loadMetrics();
    } catch (error) {
      console.error('Error creating performance snapshot:', error);
    }
  };

  const getStatusColor = (value: number, threshold: number, inverted: boolean = false) => {
    if (inverted) {
      return value < threshold ? 'destructive' : 'default';
    }
    return value > threshold ? 'destructive' : 'default';
  };

  const getStatusIcon = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getDatabaseStatus = (): 'good' | 'warning' | 'critical' => {
    if (!databaseMetrics) return 'warning';
    if (databaseMetrics.slowQueries > 10 || databaseMetrics.connectionUtilization > 80) {
      return 'critical';
    }
    if (databaseMetrics.slowQueries > 5 || databaseMetrics.connectionUtilization > 60) {
      return 'warning';
    }
    return 'good';
  };

  const githubStats = githubAPIMonitoring.getPerformanceStats(60);
  const rateLimits = githubAPIMonitoring.getRateLimitStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Performance Monitoring</h2>
          <p className="text-muted-foreground">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <Button onClick={loadMetrics} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            {getStatusIcon(getDatabaseStatus())}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {databaseMetrics ? getDatabaseStatus().toUpperCase() : 'Loading...'}
            </div>
            <p className="text-xs text-muted-foreground">
              {databaseMetrics?.slowQueries || 0} slow queries detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Pool</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {databaseMetrics?.connectionUtilization.toFixed(0) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {databaseMetrics?.totalConnections || 0}/{databaseMetrics?.maxConnections || 100} connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GitHub API</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {githubStats.totalRequests}
            </div>
            <p className="text-xs text-muted-foreground">
              requests in last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              unresolved performance alerts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="database" className="space-y-4">
        <TabsList>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="api">GitHub API</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Connection Pool Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Utilization</span>
                    <span className="text-sm text-muted-foreground">
                      {databaseMetrics?.connectionUtilization.toFixed(1) || 0}%
                    </span>
                  </div>
                  <Progress 
                    value={databaseMetrics?.connectionUtilization || 0} 
                    className="h-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Active</p>
                    <p className="font-medium">{databaseMetrics?.totalConnections || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Max</p>
                    <p className="font-medium">{databaseMetrics?.maxConnections || 100}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Query Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Slow Queries</span>
                  <Badge variant={getStatusColor(databaseMetrics?.slowQueries || 0, 5)}>
                    {databaseMetrics?.slowQueries || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Hit Ratio</span>
                  <Badge variant={getStatusColor(databaseMetrics?.cacheHitRatio || 0, 90, true)}>
                    {databaseMetrics?.cacheHitRatio.toFixed(1) || 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Database Size</span>
                  <span className="text-sm font-medium">{databaseMetrics?.databaseSize}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Request Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Requests</p>
                    <p className="font-medium">{githubStats.totalRequests}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="font-medium">
                      {githubStats.totalRequests > 0 
                        ? ((githubStats.successfulRequests / githubStats.totalRequests) * 100).toFixed(1) 
                        : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Response Time</p>
                    <p className="font-medium">{githubStats.averageResponseTime.toFixed(0)}ms</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cache Hit Rate</p>
                    <p className="font-medium">{(githubStats.cacheHitRate * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rate Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(rateLimits.entries()).map(([resource, limit]) => (
                    <div key={resource}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{resource}</span>
                        <span className="text-sm text-muted-foreground">
                          {limit.remaining}/{limit.limit}
                        </span>
                      </div>
                      <Progress 
                        value={((limit.limit - limit.remaining) / limit.limit) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                  {rateLimits.size === 0 && (
                    <p className="text-sm text-muted-foreground">No rate limit data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Alert key={alert.id} variant={alert.severity === 'critical' ? 'destructive' : 'default'}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="capitalize">
                    {alert.alert_type.replace('_', ' ')} - {alert.severity}
                  </AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      <p>
                        Current value: {alert.metric_value} (threshold: {alert.threshold_value})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                      {alert.details && (
                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                          {JSON.stringify(alert.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No Active Alerts</h3>
                  <p className="text-muted-foreground">All systems are performing normally</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={createPerformanceSnapshot} variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              Create Snapshot
            </Button>
            <Button 
              onClick={() => window.open('/monitor-db', '_blank')} 
              variant="outline"
            >
              <Zap className="h-4 w-4 mr-2" />
              View Detailed Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}