import { useState, useEffect } from "react";
import { Heart, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { calculateHealthMetrics, type HealthMetrics } from "@/lib/insights/health-metrics";


interface RepositoryHealthProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function RepositoryHealth({ owner, repo, timeRange }: RepositoryHealthProps) {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthMetrics | null>(null);

  useEffect(() => {
    loadHealthMetrics();
  }, [owner, repo, timeRange]);

  const loadHealthMetrics = async () => {
    setLoading(true);
    try {
      const metrics = await calculateHealthMetrics(owner, repo, timeRange);
      setHealth(metrics);
    } catch (error) {
      console.error("Failed to load health metrics:", error);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: HealthMetrics["trend"]) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "stable":
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "good":
        return "bg-green-500";
      case "warning":
        return "bg-yellow-500";
      case "critical":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="text-center py-8">
        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Health data unavailable
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Overall Health</h4>
          <div className="flex items-center gap-2">
            {getTrendIcon(health.trend)}
            <span className="text-xs text-muted-foreground capitalize">
              {health.trend}
            </span>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <span className={cn("text-4xl font-bold", getScoreColor(health.score))}>
              {health.score}
            </span>
            <span className="text-lg text-muted-foreground mb-1">/100</span>
          </div>
          
          <Progress value={health.score} className="h-3" />
          
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(health.lastChecked).toLocaleTimeString()}
          </p>
        </div>
      </Card>

      {/* Health Factors */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3">Health Factors</h4>
        <div className="space-y-3">
          {health.factors.map((factor) => (
            <div key={factor.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("h-2 w-2 rounded-full", getStatusColor(factor.status))} />
                  <span className="text-sm">{factor.name}</span>
                </div>
                <span className={cn("text-sm font-medium", getScoreColor(factor.score))}>
                  {factor.score}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-4">
                {factor.description}
              </p>
              <Progress value={factor.score} className="h-1.5" />
            </div>
          ))}
        </div>
      </Card>

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <Card className="p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Recommendations
          </h4>
          <ul className="space-y-2">
            {health.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground mt-0.5">•</span>
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}