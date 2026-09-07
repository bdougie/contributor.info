import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchContributorReviews } from '@/lib/contributors/fetch-contributor-reviews';
import {
  countContributorReviews,
  type ContributorReview,
} from '@/lib/contributors/contributor-reviews';

interface UseContributorReviewsOptions {
  contributorUsername: string | undefined;
  workspaceId: string | undefined;
  /** Defer fetching until the caller needs the data, such as a tab becoming active. */
  enabled?: boolean;
}

/**
 * Loads every review and inline review comment a contributor authored across
 * the workspace's tracked repositories.
 */
export function useContributorReviews({
  contributorUsername,
  workspaceId,
  enabled = true,
}: UseContributorReviewsOptions) {
  const [reviews, setReviews] = useState<ContributorReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    if (!contributorUsername || !workspaceId) return;

    setLoading(true);
    setError(null);

    try {
      setReviews(await fetchContributorReviews(contributorUsername, workspaceId));
      setLoadedFor(`${workspaceId}:${contributorUsername}`);
    } catch (err) {
      console.error('Error fetching contributor reviews:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [contributorUsername, workspaceId]);

  useEffect(() => {
    if (!enabled || !contributorUsername || !workspaceId) return;
    if (loadedFor === `${workspaceId}:${contributorUsername}`) return;
    fetchReviews();
  }, [enabled, contributorUsername, workspaceId, loadedFor, fetchReviews]);

  const counts = useMemo(() => countContributorReviews(reviews), [reviews]);

  return { reviews, counts, loading, error, refetch: fetchReviews };
}
