import { useState, useEffect, useCallback } from 'react';
import { PullRequestActivity } from '../types/github';
import { fetchPullRequestActivities } from '../services/github';

export function useGitHubActivity(repo?: string) {
  const [activities, setActivities] = useState<PullRequestActivity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchPullRequestActivities(repo);
      setActivities(data);
      setHasMore(data.length >= 25); // Show load more if we have at least a full page
    } catch (err) {
      setError(err instanceof Error ? err : new Error('An unknown error occurred'));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    
    try {
      setLoading(true);
      const newData = await fetchPullRequestActivities(repo);
      setActivities(current => [...current, ...newData]);
      setHasMore(newData.length >= 25);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more activities'));
    } finally {
      setLoading(false);
    }
  }, [repo, hasMore, loading]);

  return {
    activities,
    loading,
    error,
    hasMore,
    loadMore: handleLoadMore
  };
}