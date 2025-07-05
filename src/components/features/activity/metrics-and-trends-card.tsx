import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown, Link } from "lucide-react";
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
import { ProgressiveCaptureButton } from "./progressive-capture-button";

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [trendData, metricsData] = await Promise.all([
        calculateTrendMetrics(owner, repo, timeRange),
        calculatePrActivityMetrics(owner, repo, timeRange)
      ]);
      setTrends(trendData);
      setMetrics(metricsData);
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

  // Check if metrics suggest missing data (all zeros or very low)
  const hasLowDataQuality = (metrics: ActivityMetrics | null, trends: TrendData[]) => {
    if (!metrics) return true;
    
    // Check if review and comment activity is suspiciously low
    const reviewTrend = trends.find(t => t.metric === 'Review Activity');
    const commentTrend = trends.find(t => t.metric === 'Comment Activity');
    
    return (
      metrics.totalPRs > 0 && // Has PRs but...
      (reviewTrend?.current === 0 || commentTrend?.current === 0) // No reviews or comments
    );
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
            {/* Show compact capture button when data quality is good */}
            {!loading && !hasLowDataQuality(metrics, trends) && (
              <ProgressiveCaptureButton 
                owner={owner}
                repo={repo}
                onRefreshNeeded={loadData}
                compact={true}
              />
            )}
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
        {/* Progressive Capture Button - Show when data quality is low */}
        {!loading && hasLowDataQuality(metrics, trends) && (
          <div className="mb-6">
            <ProgressiveCaptureButton 
              owner={owner}
              repo={repo}
              onRefreshNeeded={loadData}
              compact={false}
            />
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