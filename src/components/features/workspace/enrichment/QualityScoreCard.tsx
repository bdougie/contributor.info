import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Star, MessageCircle, Eye, AlertCircle, Users } from '@/components/ui/icon';
import type { QualityScoreBreakdown } from '@/lib/llm/contributor-enrichment-types';
import { cn } from '@/lib/utils';

interface QualityScoreCardProps {
  qualityMetrics: QualityScoreBreakdown;
  className?: string;
  /** Compact layout for smaller displays */
  compact?: boolean;
}

/**
 * Icon mapping for each quality metric
 */
const metricIcons = {
  discussionImpact: MessageCircle,
  codeReviewDepth: Eye,
  issueQuality: AlertCircle,
  mentorScore: Users,
};

/**
 * Human-readable labels for metrics
 */
const metricLabels = {
  discussionImpact: 'Discussion Impact',
  codeReviewDepth: 'Code Review Depth',
  issueQuality: 'Issue Quality',
  mentorScore: 'Mentor Score',
};

/**
 * Descriptions for each metric
 */
const metricDescriptions = {
  discussionImpact: 'Participation in meaningful technical discussions and decision-making',
  codeReviewDepth: 'Thoroughness and helpfulness of code reviews',
  issueQuality: 'Clarity, detail, and actionability of reported issues',
  mentorScore: 'Helping others, answering questions, and community engagement',
};

/**
 * Get color class based on score
 */
function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-orange-600 dark:text-orange-400';
}

/**
 * Get star rating (0-5) based on score
 */
function getStarRating(score: number): number {
  return Math.round((score / 100) * 5);
}

export function QualityScoreCard({
  qualityMetrics,
  className,
  compact = false,
}: QualityScoreCardProps) {
  const overallScore = qualityMetrics.overall;
  const starRating = getStarRating(overallScore);
  const scoreColor = getScoreColor(overallScore);

  const metrics: Array<{
    key: keyof typeof metricLabels;
    value: number;
    weight: number;
  }> = [
    {
      key: 'discussionImpact',
      value: qualityMetrics.discussionImpact,
      weight: qualityMetrics.weights.discussionImpact,
    },
    {
      key: 'codeReviewDepth',
      value: qualityMetrics.codeReviewDepth,
      weight: qualityMetrics.weights.codeReviewDepth,
    },
    {
      key: 'issueQuality',
      value: qualityMetrics.issueQuality,
      weight: qualityMetrics.weights.issueQuality,
    },
    {
      key: 'mentorScore',
      value: qualityMetrics.mentorScore,
      weight: qualityMetrics.weights.mentorScore,
    },
  ];

  // Sort by weight (highest first) for visual hierarchy
  metrics.sort((a, b) => b.weight - a.weight);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Quality Score</span>
          <div className="flex items-center gap-2">
            <span
              className={cn('text-2xl font-bold', scoreColor)}
              aria-label={`Overall quality score: ${Math.round(overallScore)} out of 100`}
            >
              {Math.round(overallScore)}
            </span>
            <div
              className="flex items-center gap-0.5"
              role="img"
              aria-label={`${starRating} out of 5 stars`}
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-4 w-4',
                    i < starRating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'fill-muted text-muted-foreground/30'
                  )}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {compact ? (
          // Compact layout: 2x2 grid
          <div className="grid grid-cols-2 gap-3">
            {metrics.map(({ key, value }) => {
              const Icon = metricIcons[key];
              const label = metricLabels[key];
              const description = metricDescriptions[key];

              return (
                <div key={key} className="space-y-1" title={description}>
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    <span>{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={value}
                      className="h-2 flex-1"
                      aria-label={`${label}: ${Math.round(value)}%`}
                    />
                    <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                      {Math.round(value)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Full layout: vertical list
          <div className="space-y-3">
            {metrics.map(({ key, value, weight }) => {
              const Icon = metricIcons[key];
              const label = metricLabels[key];
              const description = metricDescriptions[key];

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2" title={description}>
                      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(weight * 100)}%)
                      </span>
                    </div>
                    <span
                      className="text-sm font-semibold"
                      aria-label={`${label}: ${Math.round(value)} out of 100`}
                    >
                      {Math.round(value)}/100
                    </span>
                  </div>
                  <Progress
                    value={value}
                    className="h-2"
                    aria-label={`${label} progress: ${Math.round(value)}%`}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 text-xs text-muted-foreground border-t">
          Quality metrics are calculated from contribution history, engagement depth, and community
          impact.
        </div>
      </CardContent>
    </Card>
  );
}
