import { useState, useEffect, useCallback } from 'react';
import { 
  fetchFilteredPullRequests, 
  getRepositorySpamStats,
  getUserSpamPreferences,
  saveUserSpamPreferences,
  type SpamFilterOptions,
  DEFAULT_SPAM_FILTER
} from '@/lib/api/spam-filtered-feed';
import type { Database } from '@/types/database';

type PullRequestWithAuthor = Database['public']['Tables']['pull_requests']['Row'] & {
  author: Database['public']['Tables']['contributors']['Row'];
  repository: Database['public']['Tables']['repositories']['Row'];
};

interface UseSpamFilteredFeedResult {
  pullRequests: PullRequestWithAuthor[];
  loading: boolean;
  error: string | null;
  spamStats: {
    totalAnalyzed: number;
    spamCount: number;
    spamPercentage: number;
    averageScore: number;
    distribution: {
      legitimate: number;
      warning: number;
      likelySpam: number;
      definiteSpam: number;
    };
  } | null;
  filterOptions: SpamFilterOptions;
  updateFilterOptions: (options: SpamFilterOptions) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useSpamFilteredFeed(
  owner: string,
  repo: string,
  limit: number = 100
): UseSpamFilteredFeedResult {
  const [pullRequests, setPullRequests] = useState<PullRequestWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spamStats, setSpamStats] = useState<UseSpamFilteredFeedResult['spamStats']>(null);
  const [filterOptions, setFilterOptions] = useState<SpamFilterOptions>(DEFAULT_SPAM_FILTER);

  // Load user preferences on mount
  useEffect(() => {
    getUserSpamPreferences().then(setFilterOptions);
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!owner || !repo) return;
    
    setLoading(true);
    setError(null);

    try {
      // Fetch filtered PRs and stats in parallel
      const [prs, stats] = await Promise.all([
        fetchFilteredPullRequests(owner, repo, filterOptions, limit),
        getRepositorySpamStats(owner, repo)
      ]);

      setPullRequests(prs);
      setSpamStats(stats);
    } catch (err) {
      console.error('Error fetching spam-filtered feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pull requests');
      setPullRequests([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo, filterOptions, limit]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update filter options
  const updateFilterOptions = useCallback(async (newOptions: SpamFilterOptions) => {
    setFilterOptions(newOptions);
    await saveUserSpamPreferences(newOptions);
  }, []);

  return {
    pullRequests,
    loading,
    error,
    spamStats,
    filterOptions,
    updateFilterOptions,
    refetch: fetchData,
  };
}

// Helper hook for spam tolerance presets
export function useSpamTolerancePresets() {
  const presets = {
    strict: {
      name: 'Strict',
      description: 'Only show high-quality PRs',
      options: {
        maxSpamScore: 25,
        includeSpam: false,
        includeUnreviewed: false,
      } as SpamFilterOptions,
    },
    balanced: {
      name: 'Balanced',
      description: 'Hide likely spam, show warnings',
      options: {
        maxSpamScore: 50,
        includeSpam: false,
        includeUnreviewed: true,
      } as SpamFilterOptions,
    },
    permissive: {
      name: 'Permissive',
      description: 'Show most PRs, hide only definite spam',
      options: {
        maxSpamScore: 75,
        includeSpam: false,
        includeUnreviewed: true,
      } as SpamFilterOptions,
    },
    all: {
      name: 'Show All',
      description: 'No filtering, show everything',
      options: {
        maxSpamScore: 100,
        includeSpam: true,
        includeUnreviewed: true,
      } as SpamFilterOptions,
    },
  };

  return presets;
}