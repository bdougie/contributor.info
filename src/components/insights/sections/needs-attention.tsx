import { useState, useEffect } from "react";
import { AlertCircle, AlertTriangle, XCircle, FileText, GitCommit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { detectPrAttention, type PrAlert, type PrAttentionMetrics } from "@/lib/insights/pr-attention";

interface NeedsAttentionProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function NeedsAttention({ owner, repo, timeRange }: NeedsAttentionProps) {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<PrAlert[]>([]);
  const [metrics, setMetrics] = useState<PrAttentionMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, [owner, repo, timeRange]);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await detectPrAttention(owner, repo, timeRange);
      setAlerts(result.alerts);
      setMetrics(result.metrics);
    } catch (err) {
      console.error("Failed to load PR alerts:", err);
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyIcon = (urgency: PrAlert["urgency"]) => {
    switch (urgency) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "low":
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getUrgencyColor = (urgency: PrAlert["urgency"]) => {
    switch (urgency) {
      case "critical":
        return "border-red-500/50 bg-red-500/5";
      case "high":
        return "border-orange-500/50 bg-orange-500/5";
      case "medium":
        return "border-yellow-500/50 bg-yellow-500/5";
      case "low":
        return "border-blue-500/50 bg-blue-500/5";
    }
  };

  const getSizeIcon = (size: PrAlert["size"]) => {
    switch (size) {
      case "xl":
        return <FileText className="h-3 w-3 text-red-500" />;
      case "large":
        return <FileText className="h-3 w-3 text-orange-500" />;
      case "medium":
        return <FileText className="h-3 w-3 text-yellow-500" />;
      case "small":
        return <FileText className="h-3 w-3 text-green-500" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Failed to load PR alerts
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadAlerts}
          className="mt-2"
        >
          Try again
        </Button>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          All pull requests are being handled efficiently!
        </p>
        {metrics && (
          <p className="text-xs text-muted-foreground mt-1">
            Checked all open PRs
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Card
          key={alert.id}
          className={cn(
            "p-3 cursor-pointer hover:shadow-md transition-all",
            getUrgencyColor(alert.urgency)
          )}
          onClick={() => window.open(alert.url, "_blank")}
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getUrgencyIcon(alert.urgency)}
                  <span className="text-sm font-medium truncate">
                    #{alert.number}
                  </span>
                  <div className="flex items-center gap-1">
                    {getSizeIcon(alert.size)}
                    {alert.isFirstTimeContributor && (
                      <Badge variant="secondary" className="text-xs">
                        First Timer
                      </Badge>
                    )}
                    {alert.isDraft && (
                      <Badge variant="outline" className="text-xs">
                        Draft
                      </Badge>
                    )}
                  </div>
                </div>
                <h4 className="text-sm font-medium line-clamp-1">
                  {alert.title}
                </h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>by {alert.author}</span>
                  <span>•</span>
                  <span>{alert.daysSinceCreated} days ago</span>
                  {alert.linesChanged > 0 && (
                    <>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <GitCommit className="h-3 w-3" />
                        <span>{alert.linesChanged} lines</span>
                      </div>
                    </>
                  )}
                  <span>•</span>
                  <span className="font-medium">Score: {alert.urgencyScore}</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {alert.reasons.map((reason, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-xs"
                >
                  {reason}
                </Badge>
              ))}
            </div>
          </div>
        </Card>
      ))}
      
      {metrics && alerts.length > 0 && (
        <div className="mt-4 p-3 bg-secondary/30 rounded-lg">
          <div className="text-xs text-muted-foreground text-center">
            <div className="grid grid-cols-4 gap-2">
              <div>
                <div className="font-medium text-red-500">{metrics.criticalCount}</div>
                <div>Critical</div>
              </div>
              <div>
                <div className="font-medium text-orange-500">{metrics.highCount}</div>
                <div>High</div>
              </div>
              <div>
                <div className="font-medium text-yellow-500">{metrics.mediumCount}</div>
                <div>Medium</div>
              </div>
              <div>
                <div className="font-medium text-blue-500">{metrics.lowCount}</div>
                <div>Low</div>
              </div>
            </div>
            {metrics.averageDaysOpen > 0 && (
              <div className="mt-2 pt-2 border-t border-border">
                Avg: {metrics.averageDaysOpen.toFixed(1)} days open
              </div>
            )}
          </div>
        </div>
      )}
      
      {alerts.length >= 10 && (
        <Button variant="ghost" className="w-full text-sm">
          View all alerts on GitHub
        </Button>
      )}
    </div>
  );
}