/**
 * React hook for fetching AI-generated contributor activity summaries
 * Uses LLM service with smart caching for performance
 * Designed for hover card integration with minimal latency
 */

import { useState, useEffect } from 'react';
import { llmService } from '@/lib/llm/llm-service';
import type { ContributorStats } from '@/lib/types';
import type { ContributorActivityData } from '@/lib/llm/contributor-summary-types';

interface UseContributorSummaryResult {
  /** AI-generated summary text (1-2 sentences) */
  summary: string | null;

  /** Loading state (true while generating summary) */
  loading: boolean;

  /** Error state (null if no error) */
  error: string | null;

  /** Confidence score of the summary (0-1) */
  confidence: number | null;
}

/**
 * Hook to fetch or generate AI summary for a contributor
 *
 * @param contributor - Contributor stats including recent activity
 * @param enabled - Whether to fetch summary (default: true)
 * @returns Summary state including loading, error, and content
 *
 * @example
 * ```tsx
 * function ContributorCard({ contributor }) {
 *   const { summary, loading } = useContributorSummary(contributor);
 *
 *   return (
 *     <div>
 *       {loading && <Skeleton />}
 *       {summary && <p className="text-muted-foreground">{summary}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useContributorSummary(
  contributor: ContributorStats,
  enabled = true
): UseContributorSummaryResult {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);

  useEffect(() => {
    // Skip if disabled or no contributor data
    if (!enabled || !contributor || !contributor.login) {
      return;
    }

    // Skip if no LLM service available
    if (!llmService.isAvailable()) {
      console.log('[AI Summary] LLM service not available for', contributor.login);
      return;
    }

    let cancelled = false;

    async function fetchSummary() {
      try {
        setLoading(true);
        setError(null);

        // Build activity data from contributor stats
        const activityData: ContributorActivityData = {
          recentPRs: contributor.recentPRs || [],
          recentIssues: contributor.recentIssues || [],
          recentActivities: contributor.recentActivities || [],
          totalContributions: contributor.pullRequests || 0,
          contributionTypes: {
            prs: contributor.recentPRs?.length || 0,
            issues: contributor.recentIssues?.length || 0,
            reviews: 0, // TODO: Add review count if available
            comments: 0, // TODO: Add comment count if available
          },
        };

        // Skip if no meaningful activity
        if (
          activityData.totalContributions === 0 &&
          activityData.recentPRs.length === 0 &&
          activityData.recentIssues.length === 0
        ) {
          console.log('[AI Summary] Skipping - no activity data for', contributor.login, {
            totalContributions: activityData.totalContributions,
            recentPRs: activityData.recentPRs.length,
            recentIssues: activityData.recentIssues.length,
          });
          setLoading(false);
          return;
        }

        console.log('[AI Summary] Generating for', contributor.login, {
          totalContributions: activityData.totalContributions,
          recentPRs: activityData.recentPRs.length,
          recentIssues: activityData.recentIssues.length,
        });

        // Generate summary (checks cache first, then generates if needed)
        const result = await llmService.generateContributorSummary(
          activityData,
          { login: contributor.login },
          {
            feature: 'hover-card-summary',
            traceId: `summary-${contributor.login}-${Date.now()}`,
          }
        );

        // Update state if request wasn't cancelled
        if (!cancelled) {
          if (result) {
            setSummary(result.content);
            setConfidence(result.confidence);
          } else {
            // LLM unavailable or failed - hide summary section
            setSummary(null);
          }
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to fetch contributor summary:', err);
          setError(err instanceof Error ? err.message : 'Failed to generate summary');
          setSummary(null);
          setLoading(false);
        }
      }
    }

    fetchSummary();

    // Cleanup function to prevent state updates after unmount
    return () => {
      cancelled = true;
    };
  }, [contributor, enabled]); // Re-fetch if contributor data changes

  return {
    summary,
    loading,
    error,
    confidence,
  };
}
