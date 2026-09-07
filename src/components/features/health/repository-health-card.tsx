import { useParams } from 'react-router';
import { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Bot } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTimeRangeStore } from '@/lib/time-range-store';
import { RepositoryHealthOverall } from '@/components/insights/sections/repository-health-overall';
import { RepositoryHealthFactors } from '@/components/insights/sections/repository-health-factors';
import { LotteryFactorContent } from './lottery-factor';
import { detectBot } from '@/lib/utils/bot-detection';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { SelfSelectionRate } from '@/components/features/contributor/self-selection-rate';
import { ContributorConfidenceCard } from './contributor-confidence-card';
import {
  calculateRepositoryConfidence,
  ConfidenceBreakdown,
  ConfidenceBreakdownWithTrend,
  ConfidenceTrendData,
} from '@/lib/insights/health-metrics';
import { useOnDemandSync } from '@/hooks/use-on-demand-sync';
import { LearnMoreLink } from '@/components/ui/learn-more-link';
import {
  hasConfidenceScore,
  SYNCED_CONFIDENCE_STALE_AFTER_MS,
} from '@/lib/insights/confidence-display-state';

interface ConfidenceSnapshot {
  key: string;
  score: number;
  calculatedAt: string | null;
  /** How old the score may be before it is flagged as stale. Undefined uses the in-app default. */
  staleAfterMs?: number;
  breakdown?: ConfidenceBreakdown['breakdown'];
  trend?: ConfidenceTrendData;
}

export function RepositoryHealthCard() {
  const { owner, repo } = useParams<{ owner: string; repo: string }>();
  const timeRange = useTimeRangeStore((state) => state.timeRange);
  const { stats, lotteryFactor, directCommitsData, includeBots } = useContext(RepoStatsContext);

  // Local state for bot toggle to avoid page refresh
  const [localIncludeBots, setLocalIncludeBots] = useState(includeBots);
  const functionTimeout = useRef<NodeJS.Timeout | null>(null);

  const confidenceKey = `${owner}/${repo}:${timeRange}`;
  const [confidenceSnapshot, setConfidenceSnapshot] = useState<ConfidenceSnapshot | null>(null);
  const confidence = confidenceSnapshot?.key === confidenceKey ? confidenceSnapshot : null;
  const [confidenceLoading, setConfidenceLoading] = useState(true);
  const [confidenceError, setConfidenceError] = useState<string | null>(null);
  const confidenceRequest = useRef(0);
  const wasSyncing = useRef(false);
  const confidenceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidateConfidenceRequest = useCallback(() => {
    confidenceRequest.current++;
    if (confidenceTimeout.current) clearTimeout(confidenceTimeout.current);
  }, []);

  // Share one sync subscription with the card so it cannot disagree with its parent.
  const {
    syncStatus: confidenceSyncStatus,
    triggerSync,
    isAuthenticated,
    refetch,
  } = useOnDemandSync({
    owner: owner || '',
    repo: repo || '',
    enabled: !!(owner && repo),
    autoTriggerOnEmpty: false,
  });

  // Sync local state with context when it changes
  useEffect(() => {
    setLocalIncludeBots(includeBots);
  }, [includeBots]);

  // Calculate contributor confidence using the same algorithm as admin dashboard
  const calculateConfidence = useCallback(
    async (forceRecalculate: boolean = false) => {
      if (!owner || !repo) return;

      const requestId = ++confidenceRequest.current;
      if (confidenceTimeout.current) clearTimeout(confidenceTimeout.current);
      setConfidenceLoading(true);
      setConfidenceError(null);
      confidenceTimeout.current = setTimeout(() => {
        if (requestId !== confidenceRequest.current) return;
        confidenceRequest.current++;
        setConfidenceLoading(false);
        setConfidenceError('Loading confidence took too long. Please try again later.');
      }, 15000);

      try {
        // Import supabase here to avoid circular dependencies
        const { supabase } = await import('@/lib/supabase');

        // Use the same function as the admin dashboard
        const { data, error } = await supabase
          .rpc('get_repository_confidence_summary_simple')
          .eq('repository_owner', owner)
          .eq('repository_name', repo)
          .abortSignal(AbortSignal.timeout(15000))
          .maybeSingle();

        if (error) throw error;

        interface ConfidenceData {
          avg_confidence_score: number | null;
          contributor_count: number;
          last_analysis: string | null;
        }

        const typedData = data as ConfidenceData | null;
        if (typedData && typedData.avg_confidence_score !== null) {
          const score = Number(typedData.avg_confidence_score);
          if (!hasConfidenceScore(score)) throw new Error('Invalid confidence score');
          if (requestId !== confidenceRequest.current) return;
          setConfidenceSnapshot({
            key: confidenceKey,
            score,
            // last_analysis is the newest role verification, i.e. the last sync,
            // not a fresh calculation. Judge its age on the sync window.
            calculatedAt: typedData.last_analysis,
            staleAfterMs: SYNCED_CONFIDENCE_STALE_AFTER_MS,
            // Preserve the current breakdown until the scoring algorithm is unified.
            breakdown: {
              starForkConfidence: Number(typedData.avg_confidence_score) * 0.35,
              engagementConfidence: Number(typedData.avg_confidence_score) * 0.25,
              retentionConfidence: Number(typedData.avg_confidence_score) * 0.25,
              qualityConfidence: Number(typedData.avg_confidence_score) * 0.15,
              totalStargazers: 0,
              totalForkers: 0,
              contributorCount: typedData.contributor_count || 0,
              conversionRate: Number(typedData.avg_confidence_score),
            },
          });
        } else {
          // Fallback to the original algorithm if no data in the new system
          const result = (await calculateRepositoryConfidence(
            owner,
            repo,
            timeRange,
            forceRecalculate,
            false, // returnMetadata
            true, // returnBreakdown
            true, // saveToHistory
            true // returnTrend
          )) as ConfidenceBreakdownWithTrend | number;

          const score = typeof result === 'number' ? result : result.score;
          if (!hasConfidenceScore(score)) throw new Error('Invalid confidence score');
          if (requestId !== confidenceRequest.current) return;
          setConfidenceSnapshot({
            key: confidenceKey,
            score,
            calculatedAt: typeof result === 'number' ? null : result.calculatedAt.toISOString(),
            breakdown: typeof result === 'number' ? undefined : result.breakdown,
            trend: typeof result === 'number' ? undefined : result.trend,
          });
        }
      } catch (error) {
        if (requestId !== confidenceRequest.current) return;
        console.error('Failed to calculate contributor confidence: %s', error);
        setConfidenceError(
          'We could not load confidence for this repository. Please try again later.'
        );
      } finally {
        if (requestId === confidenceRequest.current) {
          if (confidenceTimeout.current) clearTimeout(confidenceTimeout.current);
          setConfidenceLoading(false);
        }
      }
    },
    [owner, repo, timeRange, confidenceKey]
  );

  useEffect(() => {
    calculateConfidence();
    return invalidateConfidenceRequest;
  }, [calculateConfidence, invalidateConfidenceRequest]);

  // Keep the last known score visible throughout a refresh.
  useEffect(() => {
    const finished = wasSyncing.current && confidenceSyncStatus.isComplete;
    wasSyncing.current = confidenceSyncStatus.isTriggering || confidenceSyncStatus.isInProgress;
    if (finished) calculateConfidence(true);
  }, [
    calculateConfidence,
    confidenceSyncStatus.isComplete,
    confidenceSyncStatus.isTriggering,
    confidenceSyncStatus.isInProgress,
  ]);

  const refreshConfidence = useCallback(async () => {
    setConfidenceError(null);
    if (!isAuthenticated) {
      await Promise.all([calculateConfidence(true), refetch()]);
      return;
    }
    try {
      await triggerSync();
    } catch {
      setConfidenceError('We could not update confidence. Please try again later.');
    }
  }, [isAuthenticated, calculateConfidence, refetch, triggerSync]);

  const botCount = stats.pullRequests.filter(
    (pr) => detectBot({ githubUser: pr.user }).isBot
  ).length;
  const hasBots = botCount > 0;
  // YOLO Coders button should only be visible if there are YOLO pushes
  const showYoloButton = directCommitsData?.hasYoloCoders === true;

  const handleToggleIncludeBots = () => {
    if (functionTimeout.current) {
      clearTimeout(functionTimeout.current);
    }
    functionTimeout.current = setTimeout(() => {
      setLocalIncludeBots(!localIncludeBots);
      // We're not calling setIncludeBots anymore to avoid triggering a global state update
    }, 50);
  };

  if (!owner || !repo) {
    return null;
  }

  return (
    <Card className="health-metrics-container">
      <CardHeader>
        <CardTitle>Repository Health</CardTitle>
        <CardDescription>
          Analyze the distribution of contributions, self-selection rates, and maintainer activity
        </CardDescription>
        <LearnMoreLink
          href="https://docs.contributor.info/features/repository-health"
          feature="repository_health"
          source="repo_health_card"
        />
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Top Row - Overall Health Score (full width) */}
          <RepositoryHealthOverall stats={stats} timeRange={timeRange} />

          {/* Bottom Row - Two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Lottery Factor */}
            <Card>
              <CardContent className="p-6">
                <LotteryFactorContent
                  stats={stats}
                  lotteryFactor={lotteryFactor}
                  showYoloButton={showYoloButton}
                  includeBots={localIncludeBots}
                />

                {hasBots && (
                  <div className="flex items-center space-x-2 mt-6 pt-4 border-t">
                    <Switch
                      id="show-bots"
                      checked={localIncludeBots}
                      onCheckedChange={handleToggleIncludeBots}
                    />
                    <Label htmlFor="show-bots" className="flex items-center gap-1 cursor-pointer">
                      <Bot className="h-4 w-4" />
                      Show bots
                      {botCount > 0 && (
                        <Badge variant="outline" className="ml-1">
                          {botCount}
                        </Badge>
                      )}
                    </Label>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Column - Contributor Confidence (top), Health Factors (middle), Self-Selection Rate (bottom) */}
            <div className="space-y-6">
              {/* Contributor Confidence - Top */}
              <ContributorConfidenceCard
                confidenceScore={confidence?.score ?? null}
                calculatedAt={confidence?.calculatedAt}
                staleAfterMs={confidence?.staleAfterMs}
                syncStatus={confidenceSyncStatus}
                loading={confidenceLoading}
                error={confidenceError}
                className="w-full"
                breakdown={confidence?.breakdown}
                trend={confidence?.trend}
                onRefresh={refreshConfidence}
              />

              {/* Health Factors - Middle */}
              <RepositoryHealthFactors
                stats={stats}
                timeRange={timeRange}
                repositoryName={`${owner}/${repo}`}
              />

              {/* Self-Selection Rate - Bottom */}
              <SelfSelectionRate owner={owner} repo={repo} daysBack={Number(timeRange)} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
