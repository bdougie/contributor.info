import { useState, useEffect } from 'react'
import { Activity, AlertCircle, Clock, Zap, Layout, Wifi } from '@/components/ui/icon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getWebVitalsAnalytics } from '@/lib/web-vitals-analytics';
import { THRESHOLDS } from '@/lib/web-vitals-monitoring';
import { LineChart, DonutChart, type DonutChartData } from '@/components/ui/charts';
import { NetlifyRUMIntegration } from './netlify-rum-integration';
import { getTimeRangeHours, getRatingClass, getRatingBadgeVariant } from '@/lib/utils/performance-helpers';

interface MetricSummary {
  p50: number;
  p75: number;
  p95: number;
  good: number;
  needsImprovement: number;
  poor: number;
  total: number;
}

interface PerformanceSummary {
  LCP?: MetricSummary;
  INP?: MetricSummary;
  CLS?: MetricSummary;
  FCP?: MetricSummary;
  TTFB?: MetricSummary;
}

const METRIC_ICONS = {
  LCP: Layout,
  INP: Zap,
  CLS: Activity,
  FCP: Clock,
  TTFB: Wifi,
};

const RATING_COLORS = {
  good: '#10b981',
  'needs-improvement': '#f59e0b',
  poor: '#ef4444',
};

export function WebVitalsDashboard({ repository }: { repository?: string }) {
  const [summary, setSummary] = useState<PerformanceSummary>({});
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [selectedMetric, setSelectedMetric] = useState<'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'>('LCP');
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    loadPerformanceData();
  }, [repository, timeRange]);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      const analytics = getWebVitalsAnalytics();
      const data = await analytics.getPerformanceSummary(repository);
      setSummary(_data);
      
      // Load historical data for charts
      const historical = await loadHistoricalData();
      setHistoricalData(historical);
    } catch (_error) {
      console.error('Failed to load performance _data:', _error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    // Mock historical data - in real implementation, fetch from analytics
    const hours = getTimeRangeHours(timeRange);
    const data = [];
    const now = Date.now();
    
    for (let i = 0; i < Math.min(hours, 24); i++) {
      data.push({
        time: new Date(now - (i * 60 * 60 * 1000)).toISOString(),
        LCP: 2000 + Math.random() * 1000,
        INP: 150 + Math.random() * 100,
        CLS: 0.05 + Math.random() * 0.1,
        FCP: 1500 + Math.random() * 500,
        TTFB: 600 + Math.random() * 400,
      });
    }
    
    return data.reverse();
  };

  const getMetricIcon = (metric: string) => {
    const Icon = METRIC_ICONS[metric as keyof typeof METRIC_ICONS] || Activity;
    return <Icon className="h-4 w-4" />;
  };

  const getMetricRating = (metric: string, value: number): 'good' | 'needs-improvement' | 'poor' => {
    const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
    if (!threshold) return 'needs-improvement';
    
    if (metric === 'CLS') {
      if (value <= threshold) return 'good';
      if (value <= threshold * 2.5) return 'needs-improvement';
      return 'poor';
    }
    
    if (value <= threshold) return 'good';
    if (value <= threshold * 1.5) return 'needs-improvement';
    return 'poor';
  };

  const formatMetricValue = (metric: string, value: number): string => {
    if (metric === 'CLS') {
      return value.toFixed(3);
    }
    return `${(value / 1000).toFixed(2)}s`;
  };

  const calculateScore = (summary: MetricSummary): number => {
    const total = summary.total || 1;
    return Math.round((summary.good / total) * 100);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Netlify RUM Integration */}
      <NetlifyRUMIntegration />
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Web Vitals Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time Core Web Vitals monitoring {repository && `for ${repository}`}
          </p>
        </div>
        
        {/* Time Range Selector */}
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
          <TabsList>
            <TabsTrigger value="1h">1 Hour</TabsTrigger>
            <TabsTrigger value="24h">24 Hours</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Overall Score */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Score</CardTitle>
          <CardDescription>Percentage of users experiencing good Core Web Vitals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const).map((metric) => {
              const data = summary[metric];
              if (!_data) return null;
              
              const score = calculateScore(_data);
              const rating = getRatingClass(score);
              
              return (
                <div key={metric} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getMetricIcon(metric)}
                      <span className="font-medium">{metric}</span>
                    </div>
                    <Badge variant={getRatingBadgeVariant(rating)}>
                      {score}%
                    </Badge>
                  </div>
                  <Progress value={score} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    P75: {formatMetricValue(metric, _data.p75)}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Metrics Details */}
      <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as any)}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="LCP">LCP</TabsTrigger>
          <TabsTrigger value="INP">INP</TabsTrigger>
          <TabsTrigger value="CLS">CLS</TabsTrigger>
          <TabsTrigger value="FCP">FCP</TabsTrigger>
          <TabsTrigger value="TTFB">TTFB</TabsTrigger>
        </TabsList>

        {(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const).map((metric) => (
          <TabsContent key={metric} value={metric} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Percentiles Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getMetricIcon(metric)}
                    {metric} Percentiles
                  </CardTitle>
                  <CardDescription>
                    {metric === 'LCP' && 'Largest Contentful Paint'}
                    {metric === 'INP' && 'Interaction to Next Paint'}
                    {metric === 'CLS' && 'Cumulative Layout Shift'}
                    {metric === 'FCP' && 'First Contentful Paint'}
                    {metric === 'TTFB' && 'Time to First Byte'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {summary[metric] && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">P50 (Median)</span>
                        <Badge variant={getMetricRating(metric, summary[metric]!.p50) === 'good' ? 'default' : 'secondary'}>
                          {formatMetricValue(metric, summary[metric]!.p50)}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">P75</span>
                        <Badge variant={getMetricRating(metric, summary[metric]!.p75) === 'good' ? 'default' : 'secondary'}>
                          {formatMetricValue(metric, summary[metric]!.p75)}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">P95</span>
                        <Badge variant={getMetricRating(metric, summary[metric]!.p95) === 'good' ? 'default' : 'secondary'}>
                          {formatMetricValue(metric, summary[metric]!.p95)}
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Distribution Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribution</CardTitle>
                  <CardDescription>User experience breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary[metric] && (() => {
                    const total = summary[metric]!.good + summary[metric]!.needsImprovement + summary[metric]!.poor;
                    const donutData: DonutChartData[] = [
                      { 
                        id: 'good', 
                        label: 'Good', 
                        value: summary[metric]!.good,
                        percentage: (summary[metric]!.good / total) * 100,
                        color: RATING_COLORS.good
                      },
                      { 
                        id: 'needs-improvement', 
                        label: 'Needs Improvement', 
                        value: summary[metric]!.needsImprovement,
                        percentage: (summary[metric]!.needsImprovement / total) * 100,
                        color: RATING_COLORS['needs-improvement']
                      },
                      { 
                        id: 'poor', 
                        label: 'Poor', 
                        value: summary[metric]!.poor,
                        percentage: (summary[metric]!.poor / total) * 100,
                        color: RATING_COLORS.poor
                      },
                    ];
                    
                    return (
                      <div className="flex justify-center">
                        <DonutChart
                          data={donutData}
                          width={200}
                          height={200}
                          innerRadius={60}
                          outerRadius={80}
                          showLabel={false}
                          centerLabel={`${Math.round((summary[metric]!.good / total) * 100)}%`}
                          centerSubLabel="Good"
                        />
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>

            {/* Historical Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Historical Trend</CardTitle>
                <CardDescription>P75 values over time</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  // Transform data for uPlot LineChart
                  const timestamps = historicalData.map(d => new Date(d.time).getTime() / 1000);
                  const values = historicalData.map(d => d[metric]);
                  const threshold = THRESHOLDS[metric];
                  const thresholdValues = historicalData.map(() => threshold);
                  
                  const chartData = {
                    labels: timestamps,
                    datasets: [
                      {
                        label: metric,
                        data: values,
                        color: '#8884d8',
                        strokeWidth: 2,
                        fill: false,
                        points: false,
                      },
                      {
                        label: 'Good Threshold',
                        data: thresholdValues,
                        color: '#10b981',
                        strokeWidth: 1,
                        fill: false,
                        points: false,
                      }
                    ]
                  };
                  
                  // Detect theme
                  const isDark = typeof window !== 'undefined' && 
                    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
                  
                  return (
                    <LineChart
                      data={chartData}
                      height={300}
                      isDark={isDark}
                      showGrid={true}
                      showLegend={true}
                      xAxisLabel=""
                      yAxisLabel={metric === 'CLS' ? 'Score' : 'Time (ms)'}
                    />
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Alerts */}
      {Object.entries(summary).some(([metric, _data]) => 
        data && data.p75 > THRESHOLDS[metric as keyof typeof THRESHOLDS] * 1.5
      ) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Performance Alert</AlertTitle>
          <AlertDescription>
            Some metrics are exceeding critical thresholds. Review the dashboard for details.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}