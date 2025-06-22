import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Activity, Calendar, Users, GitPullRequest } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { calculateTrendMetrics, type TrendData } from "@/lib/insights/trends-metrics";


interface TrendsProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function Trends({ owner, repo, timeRange }: TrendsProps) {
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
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: TrendData["trend"], change: number) => {
    if (trend === "stable" || change === 0) return null;
    
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

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div className="text-center py-2">
        <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Not enough data to show trends
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {trends.map((trend, index) => {
        // Map icon strings to components
        const IconComponent = {
          GitPullRequest,
          Users,
          Calendar,
          Activity
        }[trend.icon] || Activity;
        
        return (
          <Card key={index} className="p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-medium">{trend.metric}</h4>
                </div>
              
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-2xl font-bold">
                  {trend.current}
                </span>
                {trend.unit && (
                  <span className="text-sm text-muted-foreground">
                    {trend.unit}
                  </span>
                )}
                
                <div className="flex items-center gap-1 ml-2">
                  {getTrendIcon(trend.trend, trend.change)}
                  <span className={cn("text-sm font-medium", getTrendColor(trend.change))}>
                    {trend.change > 0 ? "+" : ""}{trend.change}%
                  </span>
                </div>
              </div>
              
              {trend.insight && (
                <p className="text-xs text-muted-foreground">
                  {trend.insight}
                </p>
              )}
            </div>
            
            <Badge variant="secondary" className="text-xs">
              vs previous
            </Badge>
          </div>
          </Card>
        );
      })}
      
      <div className="pt-2 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Comparing to previous {timeRange} day period
        </p>
      </div>
    </div>
  );
}