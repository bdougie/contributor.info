import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Globe,
  Zap,
  Activity,
  Heart,
  Image,
} from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { githubAPIMonitoring } from '@/lib/github-api-monitoring';
import { HybridQueueStatus } from '@/components/features/monitoring/hybrid-queue-status';
import { GitHubActionsMonitor } from '@/components/features/monitoring/github-actions-monitor';

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
  details?: unknown;
}

interface HealthEndpointData {
  success: boolean;
  status: string;
  timestamp: string;
  [key: string]: unknown;
}

interface CDNMetrics {
  totalFiles: number;
  totalSize: number;
  avgFileSize: number;
  avgLoadTime: number;
  cacheHitRate: number;
  performanceScore: 'Excellent' | 'Good' | 'Fair' | 'Poor';
}

export function PerformanceMonitoringDashboard() {
  const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes instead of 1 minute

  const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [healthData, setHealthData] = useState<{
    main: HealthEndpointData | null;
    database: HealthEndpointData | null;
    github: HealthEndpointData | null;
  }>({ main: null, _database: null, github: null });
  const [cdnMetrics, setCdnMetrics] = useState<CDNMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealthEndpoints = useCallback(async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.warn('Missing Supabase configuration for health endpoints');
      return { main: null, database: null, github: null };
    }

    const headers = {
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const [mainHealth, databaseHealth, githubHealth] = await Promise.allSettled([
        fetch(`${supabaseUrl}/functions/v1/health`, { headers }).then((r) => r.json()),
        fetch(`${supabaseUrl}/functions/v1/health-_database`, { headers }).then((r) => r.json()),
        fetch(`${supabaseUrl}/functions/v1/health-github`, { headers }).then((r) => r.json()),
      ]);

      return {
        main: mainHealth.status === 'fulfilled' ? mainHealth.value : null,
        database: databaseHealth.status === 'fulfilled' ? databaseHealth.value : null,
        github: githubHealth.status === 'fulfilled' ? githubHealth.value : null,
      };
    } catch (_error) {
      console.error('Error fetching health endpoints:', _error);
      return { main: null, database: null, github: null };
    }
  }, []);

  const loadCDNMetrics = useCallback(async () => {
    try {
      // Get social cards storage metrics
      const { data: files, error: _error } = await supabase.storage.from('social-cards').list('', {
        limit: 1000,
        sortBy: { column: 'created_at', order: 'desc' },
      });

      if (!_error && files) {
        const totalSize = files.reduce((sum, file) => sum + (file.meta_data?.size || 0), 0);
        const avgFileSize = files.length > 0 ? totalSize / files.length : 0;

        // Mock CDN performance data (in production, this would come from actual CDN analytics)
        const avgLoadTime = 250; // ms
        const cacheHitRate = 85; // percentage

        let performanceScore: CDNMetrics['performanceScore'] = 'Good';
        if (avgLoadTime > 1000) performanceScore = 'Poor';
        else if (avgLoadTime > 500) performanceScore = 'Fair';
        else if (avgLoadTime < 100) performanceScore = 'Excellent';

        setCdnMetrics({
          totalFiles: files.length,
          totalSize,
          avgFileSize,
          avgLoadTime,
          cacheHitRate,
          performanceScore,
        });
      }
    } catch (_error) {
      console.error('Error loading CDN metrics:', _error);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);

      // Load health endpoint data first (critical)
      const healthEndpoints = await fetchHealthEndpoints();
      setHealthData(healthEndpoints);

      // Load other metrics in parallel but don't block on them
      const metricsPromise = Promise.all([
        supabase.from('slow_queries').select('*'),
        supabase.rpc('get_connection_pool_status'),
        supabase.rpc('get__database_size_stats'),
        supabase
          .from('query_performance_alerts')
          .select('*')
          .is('resolved_at', null)
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      // Load CDN metrics
      await loadCDNMetrics();

      const [slowQueriesResult, connectionStatusResult, databaseSizeResult, alertsResult] =
        await metricsPromise;

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

      setAlerts(alertsResult._data || []);
      setLastRefresh(new Date());
    } catch (_error) {
      console.error('Error loading performance metrics:', _error);
    } finally {
      setLoading(false);
    }
  }, [fetchHealthEndpoints, loadCDNMetrics]);

  const createPerformanceSnapshot = useCallback(async () => {
    try {
      await supabase.rpc('create_performance_snapshot');
      await loadMetrics();
    } catch (_error) {
      console.error('Error creating performance snapshot:', _error);
    }
  }, [loadMetrics]);

  const getStatusColor = useCallback(
    (value: number, threshold: number, inverted: boolean = false) => {
      if (inverted) {
        return value < threshold ? 'destructive' : 'default';
      }
      return value > threshold ? 'destructive' : 'default';
    },
    [],
  );

  const getStatusIcon = useCallback((status: 'good' | 'warning' | 'critical') => {
    switch (_status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  }, []);

  const getDatabaseStatus = useCallback((): 'good' | 'warning' | 'critical' => {
    if (healthData._database?.status === 'unhealthy') return 'critical';
    if (healthData._database?.status === 'degraded') return 'warning';
    if (!_databaseMetrics) return 'warning';
    if (databaseMetrics.slowQueries > 10 || _databaseMetrics.connectionUtilization > 80) {
      return 'critical';
    }
    if (databaseMetrics.slowQueries > 5 || _databaseMetrics.connectionUtilization > 60) {
      return 'warning';
    }
    return 'good';
  }, [healthData.database, databaseMetrics]);

  const getOverallHealthStatus = useCallback((): 'good' | 'warning' | 'critical' => {
    const dbStatus = getDatabaseStatus();
    const githubStatus =
      healthData.github?.status === 'healthy'
        ? 'good'
        : healthData.github?.status === 'degraded'
          ? 'warning'
          : 'critical';
    const mainStatus =
      healthData.main?.status === 'healthy'
        ? 'good'
        : healthData.main?.status === 'degraded'
          ? 'warning'
          : 'critical';

    if (dbStatus === 'critical' || githubStatus === 'critical' || mainStatus === 'critical') {
      return 'critical';
    }
    if (dbStatus === 'warning' || githubStatus === 'warning' || mainStatus === 'warning') {
      return 'warning';
    }
    return 'good';
  }, [getDatabaseStatus, healthData.github, healthData.main]);

  const getHealthSummary = useCallback((): string => {
    const issues = [];
    if (healthData.database && healthData._database.status !== 'healthy') {
      issues.push('_database');
    }
    if (healthData.github && healthData.github.status !== 'healthy') {
      issues.push('GitHub API');
    }
    if (issues.length === 0) {
      return 'All systems operational';
    }
    return `Issues: ${issues.join(', ')}`;
  }, [healthData.database, healthData.github]);

  // Simple computed values without over-memoization
  const githubStats = githubAPIMonitoring.getPerformanceStats(60);
  const rateLimits = githubAPIMonitoring.getRateLimitStatus();

  // Simple useEffect for metrics loading
  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadMetrics, AUTO_REFRESH_INTERVAL]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Performance Monitoring</h2>
          <p className="text-muted-foreground">Last updated: {lastRefresh.toLocaleTimeString()}</p>
        </div>
        <Button onClick={loadMetrics} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            {getStatusIcon(getOverallHealthStatus())}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getOverallHealthStatus().toUpperCase()}</div>
            <p className="text-xs text-muted-foreground">{getHealthSummary()}</p>
          </CardContent>
        </Card>

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
              {healthData.database?.connectivity?.latency
                ? `${healthData.database.connectivity.latency}ms`
                : 'N/A'}{' '}
              latency
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
              {databaseMetrics?.totalConnections || 0}/{databaseMetrics?.maxConnections || 100}{' '}
              connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">GitHub API</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{githubStats.totalRequests}</div>
            <p className="text-xs text-muted-foreground">requests in last hour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">unresolved performance alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CDN Performance</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cdnMetrics?.performanceScore || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              {cdnMetrics ? `${cdnMetrics.avgLoadTime}ms avg load` : 'Loading...'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">Health Endpoints</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="api">GitHub API</TabsTrigger>
          <TabsTrigger value="queues">Job Queues</TabsTrigger>
          <TabsTrigger value="workflows">GitHub Actions</TabsTrigger>
          <TabsTrigger value="cdn">CDN</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Main Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthData.main ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge
                        variant={healthData.main.status === 'healthy' ? 'default' : 'destructive'}
                      >
                        {healthData.main.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      DB: {healthData.main.checks?.database?.latency || 'N/A'}ms | System:{' '}
                      {healthData.main.checks?.system?.latency || 'N/A'}ms
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated: {new Date(healthData.main.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Database Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthData.database ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge
                        variant={
                          healthData.database.status === 'healthy' ? 'default' : 'destructive'
                        }
                      >
                        {healthData.database.status}
                      </Badge>
                    </div>
                    <div className="text-xs space-y-1">
                      <div>
                        Connectivity: {healthData.database.connectivity?.latency || 'N/A'}ms
                      </div>
                      <div>
                        Slow queries: {healthData.database.performance?.slow_queries_5min || 0}
                      </div>
                      <div>Active alerts: {healthData.database.alerts?.count || 0}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated: {new Date(healthData._database.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  GitHub API Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                {healthData.github ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge
                        variant={healthData.github.status === 'healthy' ? 'default' : 'destructive'}
                      >
                        {healthData.github.status}
                      </Badge>
                    </div>
                    <div className="text-xs space-y-1">
                      <div>Connectivity: {healthData.github.connectivity?.latency || 'N/A'}ms</div>
                      <div>Auth: {healthData.github.authentication?.status || 'N/A'}</div>
                      <div>Rate limits: {healthData.github.rate_limits?.status || 'N/A'}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Updated: {new Date(healthData.github.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No data available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Health Recommendations */}
          {healthData.github?.recommendations && healthData.github.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Health Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {healthData.github.recommendations.map((rec: string, index: number) => (
                    <Alert key={index} variant="default">
                      <Activity className="h-4 w-4" />
                      <AlertDescription>{rec}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

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
                  <Progress value={databaseMetrics?.connectionUtilization || 0} className="h-2" />
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
                  <Badge variant={getStatusColor(_databaseMetrics?.slowQueries || 0, 5)}>
                    {databaseMetrics?.slowQueries || 0}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cache Hit Ratio</span>
                  <Badge variant={getStatusColor(_databaseMetrics?.cacheHitRatio || 0, 90, true)}>
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
                        ? (
                            (githubStats.successfulRequests / githubStats.totalRequests) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
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

        <TabsContent value="queues" className="space-y-4">
          <HybridQueueStatus showTabs={true} autoRefresh={true} refreshInterval={30000} />
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <GitHubActionsMonitor showAll={true} autoRefresh={true} refreshInterval={60000} />
        </TabsContent>

        <TabsContent value="cdn" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  CDN Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cdnMetrics ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Performance Score</span>
                      <Badge
                        variant={
                          cdnMetrics.performanceScore === 'Excellent'
                            ? 'default'
                            : cdnMetrics.performanceScore === 'Poor'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {cdnMetrics.performanceScore}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Avg Load Time</p>
                        <p className="font-medium">{cdnMetrics.avgLoadTime}ms</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Cache Hit Rate</p>
                        <p className="font-medium">{cdnMetrics.cacheHitRate}%</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Cache Efficiency</span>
                        <span className="text-sm text-muted-foreground">
                          {cdnMetrics.cacheHitRate}%
                        </span>
                      </div>
                      <Progress value={cdnMetrics.cacheHitRate} className="h-2" />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Loading CDN metrics...</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Storage Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cdnMetrics ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Files</p>
                        <p className="font-medium">{cdnMetrics.totalFiles.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Size</p>
                        <p className="font-medium">
                          {(cdnMetrics.totalSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Average File Size</span>
                      <span className="text-sm font-medium">
                        {(cdnMetrics.avgFileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <Alert variant="default">
                      <Activity className="h-4 w-4" />
                      <AlertDescription>
                        Social cards are served via Supabase CDN with automatic compression and
                        global distribution.
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">Loading storage metrics...</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* CDN Recommendations */}
          {cdnMetrics && (
            <Card>
              <CardHeader>
                <CardTitle>CDN Optimization Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cdnMetrics.avgLoadTime > 500 && (
                    <Alert variant="default">
                      <Zap className="h-4 w-4" />
                      <AlertDescription>
                        Consider optimizing image compression to reduce load times
                      </AlertDescription>
                    </Alert>
                  )}
                  {cdnMetrics.cacheHitRate < 80 && (
                    <Alert variant="default">
                      <Activity className="h-4 w-4" />
                      <AlertDescription>
                        Set longer cache control headers for better CDN performance
                      </AlertDescription>
                    </Alert>
                  )}
                  {cdnMetrics.avgFileSize > 500000 && (
                    <Alert variant="default">
                      <Image className="h-4 w-4" />
                      <AlertDescription>
                        Social card file sizes are large - consider optimization
                      </AlertDescription>
                    </Alert>
                  )}
                  {cdnMetrics.performanceScore === 'Excellent' && (
                    <Alert variant="default">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        CDN performance is excellent! Keep up the good work.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          {alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert) => (
                <Alert
                  key={alert.id}
                  variant={alert.severity === 'critical' ? 'destructive' : 'default'}
                >
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
              <CardContent className="flex items-center justify-center py-2">
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
            <Button onClick={() => window.open('/monitor-db', '_blank')} variant="outline">
              <Zap className="h-4 w-4 mr-2" />
              View Detailed Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
