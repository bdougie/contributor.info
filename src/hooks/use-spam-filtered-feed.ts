import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchFilteredPullRequests,
  getRepositorySpamStats,
  getUserSpamPreferences,
  saveUserSpamPreferences,
  type SpamFilterOptions,
  DEFAULT_SPAM_FILTER,
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
  const [allPullRequests, setAllPullRequests] = useState<PullRequestWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spamStats, setSpamStats] = useState<UseSpamFilteredFeedResult['spamStats']>(null);
  const [filterOptions, setFilterOptions] = useState<SpamFilterOptions>(DEFAULT_SPAM_FILTER);

  // Load user preferences on mount
  useEffect(() => {
    getUserSpamPreferences().then(setFilterOptions);
  }, []);

  // Fetch data (only when owner/repo changes, not when filters change)
  const fetchData = useCallback(async () => {
    if (!owner || !repo) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all PRs and stats in parallel (don't filter server-side)
      const [prs, stats] = await Promise.all([
        fetchFilteredPullRequests(
          owner,
          repo,
          { includeUnreviewed: true, maxSpamScore: 100 },
          limit * 3
        ),
        getRepositorySpamStats(owner, repo),
      ]);

      setAllPullRequests(prs);
      setSpamStats(stats);
    } catch (err) {
      console.error('Error fetching spam-filtered feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch pull requests');
      setAllPullRequests([]);
    } finally {
      setLoading(false);
    }
  }, [owner, repo, limit]);

  // Fetch data when owner/repo changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply client-side filtering and sorting to the loaded data
  const pullRequests = useMemo(() => {
    const filtered = allPullRequests.filter((pr) => {
      // Treat both null and 0 spam scores as unanalyzed
      const isUnanalyzed = pr.spam_score === null || pr.spam_score === 0;

      if (isUnanalyzed) {
        return filterOptions.includeUnreviewed !== false;
      }

      // Apply spam score range filter
      const spamScore = pr.spam_score!; // We know it's not null/0 at this point
      if (filterOptions.minSpamScore !== undefined && spamScore < filterOptions.minSpamScore) {
        return false;
      }
      if (
        filterOptions.maxSpamScore !== undefined &&
        filterOptions.maxSpamScore < 100 &&
        spamScore > filterOptions.maxSpamScore
      ) {
        return false;
      }

      return true;
    });

    // Sort by spam score descending (highest probability first), then by date
    filtered.sort((a, b) => {
      // Treat both null and 0 as unanalyzed
      const aUnanalyzed = a.spam_score === null || a.spam_score === 0;
      const bUnanalyzed = b.spam_score === null || b.spam_score === 0;

      // First, prioritize PRs with analyzed spam scores over unanalyzed ones
      if (aUnanalyzed && !bUnanalyzed) return 1;
      if (!aUnanalyzed && bUnanalyzed) return -1;

      // If both have analyzed spam scores, sort by score descending (highest first)
      if (!aUnanalyzed && !bUnanalyzed) {
        if (a.spam_score !== b.spam_score) {
          return b.spam_score! - a.spam_score!; // We know they're not null/0 at this point
        }
      }

      // If spam scores are equal (or both unanalyzed), sort by date descending (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return filtered.slice(0, limit);
  }, [allPullRequests, filterOptions, limit]);

  // Update filter options (no refetch needed)
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
    spam_first: {
      name: 'Spam First',
      description: 'Show analyzed PRs only, highest spam scores first',
      options: {
        maxSpamScore: 100,
        includeUnreviewed: false,
      } as SpamFilterOptions,
    },
    likely_spam: {
      name: 'Likely Spam',
      description: 'Show only probable spam (50%+)',
      options: {
        minSpamScore: 50,
        maxSpamScore: 100,
        includeUnreviewed: false,
      } as SpamFilterOptions,
    },
    definite_spam: {
      name: 'Definite Spam',
      description: 'Show only high confidence spam (75%+)',
      options: {
        minSpamScore: 75,
        maxSpamScore: 100,
        includeUnreviewed: false,
      } as SpamFilterOptions,
    },
    clean_only: {
      name: 'Clean Only',
      description: 'Show only legitimate PRs (0-25%)',
      options: {
        maxSpamScore: 25,
        includeUnreviewed: false,
      } as SpamFilterOptions,
    },
  };

  return presets;
}
