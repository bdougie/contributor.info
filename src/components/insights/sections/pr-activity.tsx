import { useState, useEffect } from "react";
import { GitPullRequest, Clock, Users, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { calculatePrActivityMetrics, type ActivityMetrics } from "@/lib/insights/pr-activity-metrics";


interface PrActivityProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function PrActivity({ owner, repo, timeRange }: PrActivityProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ActivityMetrics | null>(null);

  useEffect(() => {
    loadMetrics();
  }, [owner, repo, timeRange]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const metrics = await calculatePrActivityMetrics(owner, repo, timeRange);
      setMetrics(metrics);
    } catch (error) {
      console.error("Failed to load PR metrics:", error);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <GitPullRequest className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          No activity data available
        </p>
      </div>
    );
  }

  const mergeTimeColor = metrics.averageMergeTime <= 24 ? "text-green-500" : 
                        metrics.averageMergeTime <= 72 ? "text-yellow-500" : "text-red-500";

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Open</span>
          </div>
          <p className="text-2xl font-bold mt-2">{metrics.openPRs}</p>
          <p className="text-xs text-muted-foreground">
            of {metrics.totalPRs} total
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center justify-between">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Avg Time</span>
          </div>
          <p className={cn("text-2xl font-bold mt-2", mergeTimeColor)}>
            {metrics.averageMergeTime < 24 
              ? `${Math.round(metrics.averageMergeTime)}h`
              : `${(metrics.averageMergeTime / 24).toFixed(1)}d`
            }
          </p>
          <div className="flex items-center gap-1">
            {metrics.averageMergeTimeTrend === "down" ? (
              <TrendingDown className="h-3 w-3 text-green-500" />
            ) : metrics.averageMergeTimeTrend === "up" ? (
              <TrendingUp className="h-3 w-3 text-red-500" />
            ) : null}
            <p className="text-xs text-muted-foreground">to merge</p>
          </div>
        </Card>
      </div>

      {/* Velocity */}
      <Card className="p-3">
        <h4 className="text-sm font-medium mb-2">Weekly Velocity</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">This week</span>
            <span className="text-sm font-medium">{metrics.velocity.current} PRs</span>
          </div>
          <Progress 
            value={(metrics.velocity.current / Math.max(metrics.velocity.current, metrics.velocity.previous)) * 100} 
            className="h-2"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last week</span>
            <span className="text-sm">{metrics.velocity.previous} PRs</span>
          </div>
          {metrics.velocity.change !== 0 && (
            <p className={cn(
              "text-xs font-medium mt-1",
              metrics.velocity.change > 0 ? "text-green-500" : "text-red-500"
            )}>
              {metrics.velocity.change > 0 ? "+" : ""}{metrics.velocity.change}% change
            </p>
          )}
        </div>
      </Card>

      {/* Top Contributors */}
      <Card className="p-3">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Active Contributors
        </h4>
        <div className="space-y-2">
          {metrics.topContributors.length > 0 ? (
            metrics.topContributors.map((contributor) => (
              <div key={contributor.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                    {contributor.name[0].toUpperCase()}
                  </div>
                  <span className="text-sm">{contributor.name}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {contributor.prCount} PRs
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              No contributors in this period
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}