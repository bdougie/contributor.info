import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, RefreshCw, Loader2 } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import type { ContributorEnrichmentData } from '@/hooks/useContributorActivity';
import { PersonaBadges } from './PersonaBadges';
import { TopicTags } from './TopicTags';
import { QualityScoreCard } from './QualityScoreCard';
import { TopicShiftBadge } from './TopicShiftBadge';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

interface ContributorInsightsProps {
  enrichment: ContributorEnrichmentData | null;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const REFRESH_COOLDOWN_MS = 10000; // 10 seconds between refreshes

/**
 * Get timeframe label for display
 */
function getLastUpdated(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Skeleton loader for insights panel
 */
function InsightsSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">AI Insights</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Persona skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          <div className="flex gap-2">
            <div className="h-7 w-24 bg-muted animate-pulse rounded" />
            <div className="h-7 w-28 bg-muted animate-pulse rounded" />
          </div>
        </div>

        {/* Topics skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-24 bg-muted animate-pulse rounded" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            <div className="h-6 w-28 bg-muted animate-pulse rounded" />
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>

        {/* Quality skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-28 bg-muted animate-pulse rounded" />
          <div className="h-16 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ContributorInsights({
  enrichment,
  loading,
  onRefresh,
  className,
}: ContributorInsightsProps) {
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  // Rate-limited refresh handler
  const handleRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
      return; // Still in cooldown period
    }
    setLastRefreshTime(now);
    onRefresh?.();
  }, [lastRefreshTime, onRefresh]);

  const isRefreshDisabled = loading || Date.now() - lastRefreshTime < REFRESH_COOLDOWN_MS;

  // Show skeleton while loading
  if (loading) {
    return <InsightsSkeleton />;
  }

  // Show empty state if no enrichment data
  if (!enrichment) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">AI Insights</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Brain className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">No insights available yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Insights will appear after the contributor has enough activity
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasPersonas = enrichment.persona && enrichment.persona.length > 0;
  const hasTopics = enrichment.topics && enrichment.topics.length > 0;
  const hasQuality = enrichment.qualityMetrics && enrichment.qualityMetrics.overall > 0;
  const hasTopicShifts = enrichment.topicShifts && enrichment.topicShifts.length > 0;

  // Get new topics from topic shifts for highlighting
  const newTopics = hasTopicShifts ? enrichment.topicShifts.flatMap((shift) => shift.to) : [];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Insights Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">AI Insights</CardTitle>
                <CardDescription className="text-xs">
                  Last updated: {getLastUpdated(enrichment.lastUpdated)}
                </CardDescription>
              </div>
            </div>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshDisabled}
                className="h-8"
                title={
                  isRefreshDisabled && !loading
                    ? 'Please wait before refreshing again'
                    : 'Refresh insights'
                }
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Personas Section */}
          {hasPersonas && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Detected Personas</h4>
              <PersonaBadges
                personas={enrichment.persona}
                confidence={enrichment.personaConfidence}
                showConfidence={enrichment.personaConfidence > 0}
              />
              {enrichment.contributionStyle && (
                <p className="text-xs text-muted-foreground">
                  Contribution style:{' '}
                  <span className="font-medium capitalize">{enrichment.contributionStyle}</span>
                  {enrichment.engagementPattern && (
                    <>
                      {' • '}
                      Engagement pattern:{' '}
                      <span className="font-medium capitalize">{enrichment.engagementPattern}</span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Topics Section */}
          {hasTopics && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Expertise Areas</h4>
              <TopicTags
                topics={enrichment.topics}
                confidence={enrichment.topicConfidence}
                highlightedTopics={newTopics}
                maxTopics={5}
              />
            </div>
          )}

          {/* Topic Shifts */}
          {hasTopicShifts && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Recent Focus Changes</h4>
              <div className="flex flex-wrap gap-2">
                {enrichment.topicShifts.slice(0, 3).map((shift, index) => (
                  <TopicShiftBadge key={index} shift={shift} mode="new-only" />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quality Score Card */}
      {hasQuality && <QualityScoreCard qualityMetrics={enrichment.qualityMetrics} />}
    </div>
  );
}
