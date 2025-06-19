import { useState, useEffect } from "react";
import {
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Sparkles,
  Brain,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  calculateHealthMetrics,
  type HealthMetrics,
} from "@/lib/insights/health-metrics";
import { llmService, type LLMInsight } from "@/lib/llm";

interface RepositoryHealthProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function InsightsHealth({
  owner,
  repo,
  timeRange,
}: RepositoryHealthProps) {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [llmInsight, setLlmInsight] = useState<LLMInsight | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    loadHealthMetrics();
  }, [owner, repo, timeRange]);

  const loadHealthMetrics = async () => {
    setLoading(true);
    setLlmInsight(null);

    try {
      const metrics = await calculateHealthMetrics(owner, repo, timeRange);
      setHealth(metrics);

      // Load LLM insight after health metrics are available
      if (metrics && llmService.isAvailable()) {
        loadLLMInsight(metrics);
      }
    } catch (error) {
      console.error("Failed to load health metrics:", error);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  const loadLLMInsight = async (healthData: HealthMetrics) => {
    setLlmLoading(true);
    try {
      const insight = await llmService.generateHealthInsight(healthData, {
        owner,
        repo,
      });
      setLlmInsight(insight);
    } catch (error) {
      console.error("Failed to load LLM insight:", error);
      setLlmInsight(null);
    } finally {
      setLlmLoading(false);
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600";
    if (confidence >= 0.6) return "text-yellow-600";
    return "text-gray-600";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className="text-center py-2">
        <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Health data unavailable</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* AI-Generated Insight */}
      {(llmInsight || llmLoading) && (
        <Card className="p-4 border-purple-200 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-900/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              AI Health Assessment
            </h4>
            {llmInsight && (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  getConfidenceColor(llmInsight.confidence)
                )}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {getConfidenceLabel(llmInsight.confidence)} Confidence
              </Badge>
            )}
          </div>

          {llmLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : llmInsight ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {llmInsight.content}
              </div>
              <p className="text-xs text-muted-foreground">
                Generated {new Date(llmInsight.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ) : null}
        </Card>
      )}
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
