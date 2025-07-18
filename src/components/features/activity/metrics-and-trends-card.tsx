import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown, Link, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  calculateTrendMetrics,
  type TrendData,
} from "@/lib/insights/trends-metrics";
import { PrCountCard } from "./pr-count-card";
import { AvgTimeCard } from "./avg-time-card";
import { VelocityCard } from "./velocity-card";
import { calculatePrActivityMetrics, type ActivityMetrics } from "@/lib/insights/pr-activity-metrics";
import { ProgressiveCaptureTrigger } from "@/lib/progressive-capture/manual-trigger";
// Removed Sentry import - using simple logging instead

interface MetricsAndTrendsCardProps {
  owner: string;
  repo: string;
  timeRange: string;
}

interface TrendCardProps {
  trend?: TrendData;
  loading?: boolean;
}

function TrendCard({ trend, loading = false }: TrendCardProps) {
  if (loading || !trend) {
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

  const getTrendIcon = (trendType: TrendData["trend"], change: number) => {
    if (trendType === "stable" || change === 0) return null;

    const isPositive = change > 0;
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? "text-green-500" : "text-red-500";

    return <Icon className={cn("h-4 w-4", color)} />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-green-500";
    if (change < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">{trend.metric}</h4>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{trend.current}</span>
            {trend.unit && (
              <span className="text-sm text-muted-foreground">
                {trend.unit}
              </span>
            )}

            <div className="flex items-center gap-1 ml-2">
              {getTrendIcon(trend.trend, trend.change)}
              <span
                className={cn(
                  "text-sm font-medium",
                  getTrendColor(trend.change)
                )}
              >
                {trend.change > 0 ? "+" : ""}
                {trend.change}%
              </span>
            </div>
          </div>

          {trend.insight && (
            <p className="text-xs text-muted-foreground">{trend.insight}</p>
          )}

          <Badge variant="secondary" className="text-xs">
            vs previous
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricsAndTrendsCard({ owner, repo, timeRange }: MetricsAndTrendsCardProps) {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  useEffect(() => {
    loadData();
  }, [owner, repo, timeRange]);

  // Track when status messages are displayed for monitoring
  useEffect(() => {
    if (!loading && hasLowDataQuality(metrics, trends) && metrics) {
      const statusMessage = getStatusMessage(metrics);
      
      // Simple logging for user experience tracking
      console.log('Metrics and trends user experience:', {
        repository: `${owner}/${repo}`,
        statusDisplayed: statusMessage.title,
        statusDescription: statusMessage.description,
        userCanRetry: metrics.status !== 'large_repository_protected',
        timeRange,
        component: 'MetricsAndTrendsCard',
        status: metrics.status
      });
    }
  }, [loading, metrics, trends, owner, repo, timeRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [trendData, metricsData] = await Promise.all([
        calculateTrendMetrics(owner, repo, timeRange),
        calculatePrActivityMetrics(owner, repo, timeRange)
      ]);
      setTrends(trendData);
      setMetrics(metricsData);
      
      // DISABLED: Auto-capture was causing database hammering
      // TODO: Re-implement with proper debouncing and rate limiting
      // if (hasLowDataQuality(metricsData, trendData) && !dataCapturing && !captureAttempted) {
      //   // Auto-capture logic here
      // }
    } catch (error) {
      // Log error to monitoring service in production
      if (process.env.NODE_ENV === 'development') {
        console.error("Failed to load data:", error);
      }
      setTrends([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  // Check if metrics suggest missing data or have special status
  const hasLowDataQuality = (metrics: ActivityMetrics | null, trends: TrendData[]) => {
    if (!metrics) return true;
    
    // Check for protected or error status
    if (metrics.status === 'large_repository_protected' || metrics.status === 'no_data' || metrics.status === 'error') {
      return true;
    }
    
    // More intelligent data quality check for successful status
    const reviewTrend = trends.find(t => t.metric === 'Review Activity');
    const commentTrend = trends.find(t => t.metric === 'Comment Activity');
    
    // Case 1: No PRs at all (definitely missing data)
    if (metrics.totalPRs === 0) {
      return true;
    }
    
    // Case 2: Has multiple PRs but suspiciously low engagement
    // Only flag as low quality if we have a significant number of PRs but zero engagement
    const hasSignificantPRs = metrics.totalPRs >= 5;
    const hasZeroReviews = reviewTrend?.current === 0;
    const hasZeroComments = commentTrend?.current === 0;
    const hasBothZero = hasZeroReviews && hasZeroComments;
    
    // Development logging for data completeness tracking
    if (process.env.NODE_ENV === 'development') {
      const reviewTotal = metrics.totalReviews || 0;
      const commentTotal = metrics.totalComments || 0;
      const engagementRatio = metrics.totalPRs > 0 ? (reviewTotal + commentTotal) / metrics.totalPRs : 0;
      
      console.log("📊 Data Quality Analysis for %s/%s:", owner, repo, {
        totalPRs: metrics.totalPRs,
        totalReviews: reviewTotal,
        totalComments: commentTotal,
        engagementRatio: engagementRatio.toFixed(2),
        hasZeroReviews,
        hasZeroComments,
        wouldShowRefresh: (hasSignificantPRs && hasBothZero) || (metrics.totalPRs >= 10 && (hasZeroReviews || hasZeroComments))
      });
    }
    
    // Only show refresh button if:
    // - We have 5+ PRs but absolutely no reviews AND no comments (very suspicious)
    // - OR we have 10+ PRs but missing either reviews OR comments entirely
    return (
      (hasSignificantPRs && hasBothZero) ||
      (metrics.totalPRs >= 10 && (hasZeroReviews || hasZeroComments))
    );
  };

  // Get appropriate message based on status
  const getStatusMessage = (metrics: ActivityMetrics | null) => {
    if (!metrics) return { title: "No data available", description: "Unable to load repository data" };
    
    switch (metrics.status) {
      case 'large_repository_protected':
        return {
          title: "Large Repository Protection",
          description: metrics.message || "This repository is protected from resource-intensive operations. Use progressive data capture for complete analysis."
        };
      case 'no_data':
        return {
          title: "No Data Available", 
          description: metrics.message || "No recent data found. Try using progressive data capture to populate the database."
        };
      case 'error':
        return {
          title: "Data Loading Error",
          description: metrics.message || "An error occurred while loading repository data."
        };
      default:
        return {
          title: "Missing engagement data",
          description: "This repository has PRs but appears to be missing review or comment data. Use progressive data capture to fetch complete information."
        };
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Metrics and Trends</CardTitle>
            <CardDescription>
              Snapshot comparing the previous 30 days with review and comment data
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              className="h-8 w-8"
              title="Copy page link"
            >
              <Link className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Show status message for missing data, errors, or protection */}
        {!loading && hasLowDataQuality(metrics, trends) && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-dashed">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{getStatusMessage(metrics).title}</p>
                <p className="text-xs text-muted-foreground">
                  {getStatusMessage(metrics).description}
                </p>
              </div>
              {metrics?.status !== 'large_repository_protected' && (
                <Button 
                  onClick={async () => {
                    // Simple logging for user retry action
                    console.log('User triggered progressive data capture:', {
                      repository: `${owner}/${repo}`,
                      status: metrics?.status || 'unknown',
                      action: 'progressive_capture'
                    });
                    
                    try {
                      // Netflix-like experience: Simple, user-friendly notification
                      toast.info(`Updating ${owner}/${repo}...`, {
                        description: 'Loading fresh data in the background',
                        duration: 4000
                      });
                      
                      await ProgressiveCaptureTrigger.quickFix(owner, repo);
                      
                      // Set expectation for longer processing due to rate limits
                      setTimeout(() => {
                        toast.success('Data update in progress', {
                          description: 'Background processing may take a few minutes. Fresh data will be available shortly.',
                          duration: 8000,
                          action: {
                            label: 'Check Status',
                            onClick: () => window.location.reload()
                          }
                        });
                      }, 3000); // Quick acknowledgment that jobs are queued
                      
                    } catch (error) {
                      console.error('Background update failed:', error);
                      toast.error('Unable to load fresh data', {
                        description: 'Using cached data instead. Try refreshing in a moment.',
                        duration: 10000,
                        action: {
                          label: 'Retry',
                          onClick: () => window.location.reload()
                        }
                      });
                    }
                  }}
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title={metrics?.status === 'error' ? 'Retry loading data' : 'Refresh data'}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Metrics Section */}
        <div>
          <h3 className="text-sm font-medium mb-3">Activity Metrics</h3>
          {loading || !metrics ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <PrCountCard openPRs={0} totalPRs={0} loading={true} />
              <AvgTimeCard averageMergeTime={0} loading={true} />
              <div className="sm:col-span-2 md:col-span-2">
                <VelocityCard velocity={{ current: 0, previous: 0, change: 0 }} loading={true} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <PrCountCard 
                openPRs={metrics.openPRs} 
                totalPRs={metrics.totalPRs}
                loading={loading}
              />
              <AvgTimeCard 
                averageMergeTime={metrics.averageMergeTime}
                averageMergeTimeTrend={metrics.averageMergeTimeTrend}
                loading={loading}
              />
              <div className="sm:col-span-2 md:col-span-2">
                <VelocityCard 
                  velocity={metrics.velocity}
                  loading={loading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Trends Section */}
        <div>
          <h3 className="text-sm font-medium mb-3">Trends</h3>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <TrendCard key={i} loading={true} />
              ))}
            </div>
          ) : trends.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Not enough data to show trends
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {trends.slice(0, 4).map((trend, index) => (
                <TrendCard key={index} trend={trend} loading={loading} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}