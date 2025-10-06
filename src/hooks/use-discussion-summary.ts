/**
 * React hook for fetching AI-generated discussion summaries
 * Uses LLM service with smart caching for performance
 * Designed for discussion cards/tables with minimal latency
 */

import { useState, useEffect, useMemo } from 'react';
import { llmService } from '@/lib/llm/llm-service';
import type { DiscussionData } from '@/lib/llm/discussion-summary-types';
import { useGitHubAuth } from '@/hooks/use-github-auth';

interface UseDiscussionSummaryResult {
  /** AI-generated summary text (1-2 sentences, plain text) */
  summary: string | null;

  /** Loading state (true while generating summary) */
  loading: boolean;

  /** Error state (null if no error) */
  error: string | null;

  /** Confidence score of the summary (0-1) */
  confidence: number | null;

  /** Whether authentication is required to access summaries */
  requiresAuth: boolean;
}

/**
 * Hook to fetch or generate AI summary for a discussion
 *
 * @param discussion - Discussion data including title and body
 * @param enabled - Whether to fetch summary (default: true)
 * @returns Summary state including loading, error, and content
 *
 * @example
 * ```tsx
 * function DiscussionCard({ discussion }) {
 *   const { summary, loading } = useDiscussionSummary(discussion);
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
export function useDiscussionSummary(
  discussion: DiscussionData & { id?: string },
  enabled = true
): UseDiscussionSummaryResult {
  const { isLoggedIn, loading: authLoading } = useGitHubAuth();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [requestIdRef] = useState(() => ({ current: 0 }));

  // Create stable key to prevent infinite re-renders
  const discussionKey = useMemo(() => {
    return JSON.stringify({
      id: discussion?.id || '',
      title: discussion?.title || '',
      bodyLength: discussion?.body?.length || 0,
    });
  }, [discussion]);

  useEffect(() => {
    // Track this request to prevent race conditions
    const currentRequestId = ++requestIdRef.current;

    // Create abort controller for cleanup
    const abortController = new AbortController();
    let isMounted = true;

    // Clear stale state from previous discussion before any early returns
    setSummary(null);
    setConfidence(null);
    setError(null);

    console.log('[Discussion Summary Hook] Effect triggered:', {
      enabled,
      hasDiscussion: !!discussion,
      id: discussion?.id,
      llmAvailable: llmService.isAvailable(),
      isLoggedIn,
      requestId: currentRequestId,
    });

    // Skip if disabled or no discussion data
    if (!enabled || !discussion || !discussion.title) {
      console.log('[Discussion Summary Hook] Early return - disabled or no discussion');
      setLoading(false);
      return;
    }

    // Skip if not authenticated - require login for AI summaries (PLG motion + cost control)
    if (!isLoggedIn) {
      console.log('[Discussion Summary Hook] Early return - authentication required');
      setLoading(false);
      return;
    }

    // Skip if no LLM service available
    if (!llmService.isAvailable()) {
      console.log('[Discussion Summary] LLM service not available for', discussion.id);
      setLoading(false);
      return;
    }

    async function fetchSummary() {
      try {
        // Only update loading state if this is still the current request
        if (isMounted && currentRequestId === requestIdRef.current) {
          setLoading(true);
        }

        // Build discussion data
        const discussionData: DiscussionData = {
          title: discussion.title,
          body: discussion.body || null,
          category: discussion.category,
          author: discussion.author,
          isAnswered: discussion.isAnswered,
          upvoteCount: discussion.upvoteCount,
          commentCount: discussion.commentCount,
        };

        console.log('[Discussion Summary] Generating for', discussion.id, {
          title: discussionData.title,
          bodyLength: discussionData.body?.length || 0,
          requestId: currentRequestId,
        });

        // Generate summary (checks cache first, then generates if needed)
        const result = await llmService.generateDiscussionSummary(discussionData, {
          discussionId: discussion.id || 'unknown',
          feature: 'discussion-card-summary',
          traceId: `discussion-summary-${discussion.id}-${Date.now()}`,
        });

        // Only update state if component is still mounted and this is the current request
        if (
          isMounted &&
          !abortController.signal.aborted &&
          currentRequestId === requestIdRef.current
        ) {
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
        // Only handle error if component is still mounted and this is the current request
        if (
          isMounted &&
          !abortController.signal.aborted &&
          currentRequestId === requestIdRef.current
        ) {
          console.error('Failed to fetch discussion summary:', err);
          setError(err instanceof Error ? err.message : 'Failed to generate summary');
          setSummary(null);
          setLoading(false);
        }
      }
    }

    fetchSummary();

    // Cleanup function to prevent state updates after unmount and abort any pending operations
    return () => {
      isMounted = false;
      abortController.abort();
      // If this was the current request, mark it as cancelled
      if (currentRequestId === requestIdRef.current) {
        requestIdRef.current = -1; // Mark as cancelled
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionKey, enabled, isLoggedIn]);

  return {
    summary,
    loading: loading || authLoading,
    error,
    confidence,
    requiresAuth: !isLoggedIn,
  };
}
