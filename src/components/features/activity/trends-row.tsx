import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  calculateTrendMetrics,
  type TrendData,
} from "@/lib/insights/trends-metrics";

interface TrendsRowProps {
  owner: string;
  repo: string;
  timeRange: string;
}

interface TrendCardProps {
  trend: TrendData;
  loading?: boolean;
}

function TrendCard({ trend, loading = false }: TrendCardProps) {
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

export function TrendsRow({ owner, repo, timeRange }: TrendsRowProps) {
  const [loading, setLoading] = useState(true);
  const [trends, setTrends] = useState<TrendData[]>([]);

  useEffect(() => {
    loadTrends();
  }, [owner, repo, timeRange]);

  const loadTrends = async () => {
    setLoading(true);
    try {
      const trendData = await calculateTrendMetrics(owner, repo, timeRange);
      setTrends(trendData);
    } catch (error) {
      console.error("Failed to load trends:", error);
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trends</CardTitle>
        <CardDescription>
          Comparing to previous {timeRange} day period
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <TrendCard key={i} trend={{} as TrendData} loading={true} />
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {trends.slice(0, 4).map((trend, index) => (
              <TrendCard key={index} trend={trend} loading={loading} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
