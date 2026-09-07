import { useState, memo, useMemo, useEffect } from 'react';
import {
  UserPlus,
  RefreshCw,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Clock,
} from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/hooks/use-on-demand-sync';
import { LastUpdated } from '@/components/ui/last-updated';
import {
  getConfidenceDisplayState,
  hasConfidenceScore,
  type ConfidenceDisplayState,
} from '@/lib/insights/confidence-display-state';
import { ConfidenceBreakdownTooltip } from './confidence-breakdown-tooltip';
import { ContributorConfidenceLearnMore } from './contributor-confidence-learn-more';
import { ConfidenceSkeleton } from './confidence-skeleton';
import { LearnMoreLink } from '@/components/ui/learn-more-link';

// Semicircle progress component that grows from left to right
const SemicircleProgress = memo(function SemicircleProgress({ value }: { value: number }) {
  // Scale the 0-50% score to 0-100% for semicircle display
  const scaledValue = (value / 50) * 100;
  const normalizedValue = Math.min(Math.max(scaledValue, 0), 100);

  // Color based on confidence level
  const getProgressColor = (value: number) => {
    if (value <= 5) return '#FB3748'; // Red
    if (value <= 15) return '#FFA500'; // Orange
    if (value <= 35) return '#0EA5E9'; // Blue
    return '#00C851'; // Green
  };

  // Generate progress path that grows from left to right
  const getProgressPath = (percentage: number) => {
    if (percentage <= 0) return '';

    if (percentage >= 100) {
      // Full semicircle - complete path from left to right
      return 'M0 49C0 36.0044 5.16249 23.541 14.3518 14.3518C23.5411 5.16248 36.0044 0 49 0C61.9956 0 74.459 5.16249 83.6482 14.3518C92.8375 23.5411 98 36.0044 98 49H90.16C90.16 38.0837 85.8235 27.6145 78.1045 19.8955C70.3855 12.1765 59.9163 7.84 49 7.84C38.0837 7.84 27.6145 12.1765 19.8955 19.8955C12.1765 27.6145 7.84 38.0837 7.84 49H0Z';
    }

    // Calculate the angle for the percentage - start from left (π) and move to right (0)
    const angleRadians = Math.PI - (percentage / 100) * Math.PI;

    // Outer arc points (radius = 49, center at 49,49)
    const outerStartX = 0; // Left edge
    const outerStartY = 49; // Center height
    const outerEndX = 49 + 49 * Math.cos(angleRadians);
    const outerEndY = 49 - 49 * Math.sin(angleRadians);

    // Inner arc points (radius = 41.16, center at 49,49)
    const innerStartX = 7.84; // Left edge of inner circle
    const innerStartY = 49; // Center height
    const innerEndX = 49 + 41.16 * Math.cos(angleRadians);
    const innerEndY = 49 - 41.16 * Math.sin(angleRadians);

    // Determine if we need the large arc flag
    const largeArcFlag = percentage > 50 ? 1 : 0;

    // Build the path: outer arc from left to calculated point, then inner arc back
    let path = `M${outerStartX} ${outerStartY}`; // Move to outer start (left edge)
    path += ` A49 49 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}`; // Outer arc clockwise
    path += ` L${innerEndX} ${innerEndY}`; // Line to inner arc end
    path += ` A41.16 41.16 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}`; // Inner arc counter-clockwise
    path += ` Z`; // Close path

    return path;
  };

  return <path d={getProgressPath(normalizedValue)} fill={getProgressColor(normalizedValue)} />;
});

export interface ContributorConfidenceCardProps {
  confidenceScore: number | null; // 0-100 or null when no data
  loading?: boolean;
  error?: string | null;
  className?: string;
  calculatedAt?: string | null;
  /** Age after which the score is flagged as stale. Defaults to the in-app cache lifetime. */
  staleAfterMs?: number;
  syncStatus?: SyncStatus;
  onRefresh?: () => void;
  breakdown?: {
    starForkConfidence: number;
    engagementConfidence: number;
    retentionConfidence: number;
    qualityConfidence: number;
    totalStargazers: number;
    totalForkers: number;
    contributorCount: number;
    conversionRate: number;
  };
  trend?: {
    direction: 'improving' | 'declining' | 'stable';
    changePercent: number;
    currentScore: number;
    previousScore: number;
    hasSufficientData: boolean;
  };
}

interface ConfidenceLevel {
  level: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  color: string;
}

function getTrendPrefix(direction: 'improving' | 'declining' | 'stable'): string {
  if (direction === 'improving') return '+';
  if (direction === 'declining') return '';
  return '±';
}

function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score <= 5) {
    return {
      level: 'low',
      title: 'Your project can be Intimidating',
      description:
        'Almost no stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-red-600',
    };
  } else if (score <= 15) {
    return {
      level: 'medium',
      title: 'Your project is challenging',
      description:
        'Few stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-orange-600',
    };
  } else if (score <= 35) {
    return {
      level: 'medium',
      title: 'Your project is approachable!',
      description:
        'Some stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-blue-600',
    };
  } else {
    return {
      level: 'high',
      title: 'Your project is welcoming!',
      description:
        'Many stargazers and forkers come back later on to make a meaningful contribution',
      color: 'text-green-600',
    };
  }
}

export const ContributorConfidenceCard = memo(function ContributorConfidenceCard({
  confidenceScore,
  loading = false,
  error = null,
  className,
  calculatedAt,
  staleAfterMs,
  syncStatus,
  onRefresh,
  breakdown,
  trend,
}: ContributorConfidenceCardProps) {
  // Local state for Learn More modal
  const [showLearnMore, setShowLearnMore] = useState(false);

  const [, updateClock] = useState(0);
  const now = Date.now();
  useEffect(() => {
    const timer = setInterval(() => updateClock((tick) => tick + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  const hasScore = hasConfidenceScore(confidenceScore);
  const displayState = getConfidenceDisplayState(
    { score: confidenceScore, calculatedAt, staleAfterMs, loading, error, syncStatus },
    now
  );
  const busy = displayState === 'loading' || displayState === 'refreshing';
  const showInterpretation = displayState === 'ready';
  const scoreTitle = hasScore ? 'Last known score' : 'Score unavailable';

  // Move useMemo to top level to ensure it's called on every render
  const confidence = useMemo(() => getConfidenceLevel(confidenceScore ?? 0), [confidenceScore]);

  // Render trend indicator based on direction
  const TrendIcon = useMemo(() => {
    if (!trend || !trend.hasSufficientData) return null;
    switch (trend.direction) {
      case 'improving':
        return TrendingUp;
      case 'declining':
        return TrendingDown;
      case 'stable':
        return Minus;
      default:
        return null;
    }
  }, [trend]);

  const trendColor = useMemo(() => {
    if (!trend || !trend.hasSufficientData) return '';
    switch (trend.direction) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      case 'stable':
        return 'text-muted-foreground';
      default:
        return '';
    }
  }, [trend]);
  if (displayState === 'loading') {
    return (
      <ConfidenceSkeleton
        className={className}
        message={
          syncStatus?.isInProgress || syncStatus?.isTriggering
            ? 'Updating confidence…'
            : 'Calculating…'
        }
      />
    );
  }

  const notices: Partial<Record<ConfidenceDisplayState, { title: string; message: string }>> = {
    stale: {
      title: 'Confidence data may be outdated',
      message: syncStatus?.isStalled
        ? 'The last update did not finish. This score may not reflect recent activity.'
        : 'Recent activity may be missing from this score. Check again for an update.',
    },
    error: {
      title: hasScore ? 'Could not update confidence' : 'Confidence is unavailable',
      message: error || 'We could not update this repository’s confidence. Please try again later.',
    },
    unavailable: {
      title: 'Confidence is not available yet',
      message: 'There is not enough data to show a reliable score. Please check again later.',
    },
    unknown: {
      title: 'Update time unavailable',
      message:
        'We could not verify when this score was calculated. It may not reflect recent activity.',
    },
    refreshing: {
      title: 'Updating confidence…',
      message: 'Showing the last known score while we check for an update.',
    },
  };
  const notice = notices[displayState];
  const validTimestamp =
    calculatedAt && Number.isFinite(Date.parse(calculatedAt)) && Date.parse(calculatedAt) <= now;

  return (
    <Card className={cn('w-full overflow-hidden', className)}>
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 w-full">
          <div className="flex items-center gap-2 py-1 flex-1">
            <UserPlus className="w-[18px] h-[18px]" />
            {breakdown ? (
              <ConfidenceBreakdownTooltip breakdown={breakdown}>
                <div className="inline-flex items-center gap-1 cursor-default">
                  <div className="font-semibold text-foreground text-sm whitespace-nowrap">
                    Contributor Confidence
                  </div>
                  <HelpCircle className="w-3 h-3 text-muted-foreground/60" />
                </div>
              </ConfidenceBreakdownTooltip>
            ) : (
              <div className="font-semibold text-foreground text-sm whitespace-nowrap">
                Contributor Confidence
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowLearnMore(true)}
                className="font-medium text-opensauced-orange text-xs whitespace-nowrap hover:underline hidden sm:block"
              >
                Learn More
              </button>
              <Button
                onClick={onRefresh}
                variant="ghost"
                size="sm"
                disabled={busy || !onRefresh}
                className="h-8 w-8 p-0"
                title="Check for updated confidence"
                aria-label="Check for updated confidence"
              >
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 w-full">
          <div className="relative w-[98px] h-[52px]">
            <div className="relative h-[98px] mb-[46px]">
              <div className="absolute w-[98px] h-[98px] top-0 left-0">
                <div className="relative h-[49px]">
                  {/* Background semicircle */}
                  <svg width="98" height="49" viewBox="0 0 98 49" className="absolute top-0 left-0">
                    <path
                      d="M98 49C98 36.0044 92.8375 23.5411 83.6482 14.3518C74.459 5.16249 61.9956 9.81141e-07 49 0C36.0044 -9.81141e-07 23.5411 5.16248 14.3518 14.3518C5.16249 23.541 1.96228e-06 36.0044 0 49H7.84C7.84 38.0837 12.1765 27.6145 19.8955 19.8955C27.6145 12.1765 38.0837 7.84 49 7.84C59.9163 7.84 70.3855 12.1765 78.1045 19.8955C85.8235 27.6145 90.16 38.0837 90.16 49H98Z"
                      className="fill-muted"
                    />
                  </svg>

                  {/* Progress overlay */}
                  <svg width="98" height="49" viewBox="0 0 98 49" className="absolute top-0 left-0">
                    {hasScore && <SemicircleProgress value={confidenceScore} />}
                  </svg>
                </div>
              </div>

              <ConfidenceBreakdownTooltip breakdown={breakdown}>
                <div className="absolute w-14 top-7 left-[21px] font-normal text-foreground text-[28px] text-center leading-5 cursor-help">
                  <span className="font-bold tracking-[-0.05px]">
                    {hasScore ? Math.round(confidenceScore) : '--'}
                  </span>
                  <span className="font-bold text-xs tracking-[-0.01px]">%</span>
                </div>
              </ConfidenceBreakdownTooltip>
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-start gap-1 flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-muted-foreground text-xs leading-4 whitespace-nowrap">
                {showInterpretation ? confidence.title : scoreTitle}
              </div>
              {showInterpretation && trend && trend.hasSufficientData && TrendIcon && (
                <div
                  className={`flex items-center gap-1 ${trendColor}`}
                  title={`${getTrendPrefix(trend.direction)}${Math.abs(trend.changePercent).toFixed(1)}% from previous period`}
                >
                  <TrendIcon className="w-3 h-3" />
                  <span className="text-xs font-medium">
                    {trend.changePercent > 0 ? '+' : ''}
                    {trend.changePercent.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            {showInterpretation && (
              <div className="text-sm text-muted-foreground leading-relaxed">
                {confidence.description}
              </div>
            )}
            {validTimestamp && (
              <LastUpdated
                timestamp={calculatedAt}
                label="Last calculated"
                includeStructuredData={false}
                className="mt-1"
              />
            )}
            <LearnMoreLink
              href="https://docs.contributor.info/features/contributor-confidence"
              feature="contributor_confidence"
              source="confidence_card"
              className="mt-1"
            />
          </div>
        </div>
        {notice && (
          <div
            role="status"
            className={cn(
              'flex items-start gap-2 rounded-md border p-3 text-sm',
              busy
                ? 'border-border bg-muted/40 text-muted-foreground'
                : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
            )}
          >
            {busy ? (
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0 space-y-1">
              <p className="font-medium">{notice.title}</p>
              <p className="text-xs leading-relaxed">{notice.message}</p>
              {!busy && onRefresh && (
                <Button
                  onClick={onRefresh}
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs"
                >
                  Check again
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Learn More Modal */}
      <ContributorConfidenceLearnMore open={showLearnMore} onOpenChange={setShowLearnMore} />
    </Card>
  );
});
