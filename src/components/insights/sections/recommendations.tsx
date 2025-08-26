import { useState, useEffect } from 'react';
import { Sparkles, Lightbulb, Target, Zap, CheckCircle, Brain } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { llmService, type LLMInsight } from '@/lib/llm';
import { calculateHealthMetrics } from '@/lib/insights/health-metrics';
import { calculatePrActivityMetrics } from '@/lib/insights/pr-activity-metrics';
import { calculateTrendMetrics } from '@/lib/insights/trends-metrics';

interface Recommendation {
  id: string;
  type: 'process' | 'contributor' | 'performance' | 'quality';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actionable: boolean;
  actions?: {
    label: string;
    url?: string;
    onClick?: () => void;
  }[];
  completed?: boolean;
}

interface RecommendationsProps {
  owner: string;
  repo: string;
  timeRange: string;
}

export function Recommendations({ owner, repo, timeRange }: RecommendationsProps) {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [llmInsight, setLlmInsight] = useState<LLMInsight | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  useEffect(() => {
    loadRecommendations();
  }, [owner, repo, timeRange]);

  const loadRecommendations = async () => {
    setLoading(true);
    setLlmInsight(null);

    try {
      // Fetch all insights data in parallel
      const [healthData, activityData, trendsData] = await Promise.all([
        calculateHealthMetrics(owner, repo, timeRange),
        calculatePrActivityMetrics(owner, repo, timeRange),
        calculateTrendMetrics(owner, repo, timeRange),
      ]);

      // Generate rule-based recommendations first
      const ruleBasedRecs = generateRuleBasedRecommendations(healthData, activityData, trendsData);
      setRecommendations(ruleBasedRecs);

      // Generate LLM recommendations if available
      if (llmService.isAvailable()) {
        loadLLMRecommendations(healthData, activityData, trendsData);
      }
    } catch (error) {
      console.error("Error:", error);

      // Fallback recommendations
      setRecommendations(getFallbackRecommendations());
    } finally {
      setLoading(false);
    }
  };

  const loadLLMRecommendations = async (
    healthData: unknown,
    activityData: unknown,
    trendsData: unknown[],
  ) => {
    setLlmLoading(true);
    try {
      const combinedData = {
        health: healthData,
        activity: activityData,
        trends: trendsData,
      };

      const insight = await llmService.generateRecommendations(combinedData, { owner, repo });
      setLlmInsight(insight);
    } catch (error) {
      console.error("Error:", error);
      setLlmInsight(null);
    } finally {
      setLlmLoading(false);
    }
  };

  const generateRuleBasedRecommendations = (
    healthData: unknown,
    activityData: unknown,
    trendsData: unknown[],
  ): Recommendation[] => {
    const recommendations: Recommendation[] = [];

    // Health-based recommendations
    if (healthData.score < 60) {
      const criticalFactors = healthData.factors.filter((f: unknown) => f.status === 'critical');
      if (criticalFactors.length > 0) {
        recommendations.push({
          id: 'health-critical',
          type: 'quality',
          priority: 'high',
          title: `Improve ${criticalFactors[0].name}`,
          description: criticalFactors[0].description,
          impact: 'Increase repository health score',
          actionable: true,
          actions: [
            { label: 'View health details', onClick: () => console.log('Navigate to health') },
          ],
        });
      }
    }

    // Activity-based recommendations
    if (activityData.weeklyVelocity < 5) {
      recommendations.push({
        id: 'velocity-low',
        type: 'process',
        priority: 'medium',
        title: 'Increase development velocity',
        description:
          'Weekly PR velocity is low. Consider breaking down large features into smaller PRs.',
        impact: 'Improve development speed',
        actionable: true,
        actions: [
          { label: 'GitHub Flow guide', url: 'https://guides.github.com/introduction/flow/' },
        ],
      });
    }

    // Trend-based recommendations
    const prVolumeDecline = trendsData.find(
      (t) => t.metric.includes('PR Volume') && t.trend === 'down',
    );
    if (prVolumeDecline && prVolumeDecline.change < -20) {
      recommendations.push({
        id: 'pr-decline',
        type: 'contributor',
        priority: 'medium',
        title: 'Address declining PR activity',
        description: `PR volume has decreased by ${Math.abs(prVolumeDecline.change)}%. Consider engaging more contributors.`,
        impact: 'Maintain development momentum',
        actionable: true,
        actions: [
          {
            label: 'Create good-first-issues',
            url: `https://github.com/${owner}/${repo}/labels/good%20first%20issue`,
          },
        ],
      });
    }

    // Always include general process improvements
    recommendations.push({
      id: 'automation',
      type: 'process',
      priority: 'low',
      title: 'Automate PR checks',
      description:
        'Enable GitHub Actions for automated testing and linting to reduce review burden.',
      impact: 'Reduce review time by 40%',
      actionable: true,
      actions: [
        { label: 'Setup GitHub Actions', url: `https://github.com/${owner}/${repo}/actions/new` },
      ],
    });

    return recommendations.slice(0, 4); // Limit to top 4
  };

  const getFallbackRecommendations = (): Recommendation[] => {
    return [
      {
        id: 'fallback-1',
        type: 'quality',
        priority: 'medium',
        title: 'Improve code review process',
        description: 'Establish clear review guidelines and ensure all PRs receive proper review.',
        impact: 'Better code quality',
        actionable: true,
        actions: [
          {
            label: 'Review guide',
            url: `https://github.com/${owner}/${repo}/blob/main/CONTRIBUTING.md`,
          },
        ],
      },
      {
        id: 'fallback-2',
        type: 'process',
        priority: 'low',
        title: 'Document development workflow',
        description:
          'Create clear documentation for new contributors to understand the development process.',
        impact: 'Faster onboarding',
        actionable: true,
        actions: [
          { label: 'Add README', url: `https://github.com/${owner}/${repo}/edit/main/README.md` },
        ],
      },
    ];
  };
  const getTypeIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'process':
        return Target;
      case 'contributor':
        return Lightbulb;
      case 'performance':
        return Zap;
      case 'quality':
        return Sparkles;
    }
  };

  const getPriorityColor = (priority: Recommendation['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(new Set([...dismissedIds, id]));
  };

  const visibleRecommendations = recommendations.filter(
    (rec) => !dismissedIds.has(rec.id) && !rec.completed,
  );

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (visibleRecommendations.length === 0 && !llmInsight && !llmLoading) {
    return (
      <div className="text-center py-2">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">All recommendations completed!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleRecommendations.map((rec) => {
        const Icon = getTypeIcon(rec.type);

        return (
          <Card key={rec.id} className="p-4 hover:shadow-sm transition-shadow">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-medium">{rec.title}</h4>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', getPriorityColor(rec.priority))}
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                    <p className="text-xs text-muted-foreground font-medium">
                      Impact: {rec.impact}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => handleDismiss(rec.id)}
                >
                  ×
                </Button>
              </div>

              {rec.actionable && rec.actions && rec.actions.length > 0 && (
                <div className="flex gap-2 pl-8">
                  {rec.actions.map((action, index) => (
                    <Button
                      key={index}
                      variant={index === 0 ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        if (action.url) {
                          window.open(action.url, '_blank');
                        } else if (action.onClick) {
                          action.onClick();
                        }
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* AI-Generated Recommendations */}
      {(llmInsight || llmLoading) && (
        <Card className="p-4 border-purple-200 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-900/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              AI Insights
            </h4>
            {llmInsight && (
              <Badge
                variant="outline"
                className={cn('text-xs', getConfidenceColor(llmInsight.confidence))}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {getConfidenceLabel(llmInsight.confidence)} Confidence
              </Badge>
            )}
          </div>

          {llmLoading
? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )
: llmInsight
? (
            <div className="space-y-3">
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {llmInsight.content}
              </div>
              <p className="text-xs text-muted-foreground">
                Generated {new Date(llmInsight.timestamp).toLocaleTimeString()}
              </p>
            </div>
          )
: null}
        </Card>
      )}

      {visibleRecommendations.length > 0 && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setDismissedIds(new Set())}
          >
            Show dismissed ({dismissedIds.size})
          </Button>
        </div>
      )}
    </div>
  );
}
