import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import type { Repository } from '@/components/features/workspace';

export interface SpamPullRequest {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged' | 'draft';
  spam_score: number;
  spam_flags: string[] | null;
  is_spam: boolean;
  spam_detected_at: string | null;
  repository: {
    name: string;
    owner: string;
    full_name: string;
  };
  author: {
    username: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  html_url: string;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface SpamStats {
  totalAnalyzed: number;
  spamCount: number;
  spamPercentage: number;
  averageScore: number;
  distribution: {
    legitimate: number; // 0-25
    warning: number; // 26-50
    likelySpam: number; // 51-75
    definiteSpam: number; // 76-100
  };
}

interface UseWorkspaceSpamOptions {
  repositories: Repository[];
  selectedRepositories: string[];
  minSpamScore?: number;
  maxSpamScore?: number;
  includeUnanalyzed?: boolean;
}

interface UseWorkspaceSpamResult {
  pullRequests: SpamPullRequest[];
  stats: SpamStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateSpamStatus: (prId: string, isSpam: boolean) => Promise<void>;
}

interface DatabaseSpamPR {
  id: string;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  spam_score: number | null;
  spam_flags: string[] | null;
  is_spam: boolean | null;
  spam_detected_at: string | null;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  html_url: string;
  additions: number | null;
  deletions: number | null;
  changed_files: number | null;
  repository_id: string;
  repositories?:
    | {
        id: string;
        name: string;
        owner: string;
        full_name: string;
      }
    | Array<{
        id: string;
        name: string;
        owner: string;
        full_name: string;
      }>;
  contributors?:
    | {
        id: string;
        username: string;
        avatar_url: string;
      }
    | Array<{
        id: string;
        username: string;
        avatar_url: string;
      }>;
}

/**
 * Custom hook for managing workspace spam detection data
 * Fetches PRs with spam scores and provides filtering/stats
 */
export function useWorkspaceSpam({
  repositories,
  selectedRepositories,
  minSpamScore = 0,
  maxSpamScore = 100,
  includeUnanalyzed = false,
}: UseWorkspaceSpamOptions): UseWorkspaceSpamResult {
  const [allPullRequests, setAllPullRequests] = useState<SpamPullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch PRs from database with spam data
  const fetchSpamData = useCallback(async () => {
    if (repositories.length === 0) {
      setAllPullRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = await getSupabase();

      // Filter repositories
      const filteredRepos =
        selectedRepositories.length > 0
          ? repositories.filter((r) => selectedRepositories.includes(r.id))
          : repositories;

      const repoIds = filteredRepos.map((r) => r.id);

      // Fetch PRs with spam data
      let query = supabase
        .from('pull_requests')
        .select(
          `
          id,
          number,
          title,
          state,
          draft,
          spam_score,
          spam_flags,
          is_spam,
          spam_detected_at,
          created_at,
          updated_at,
          merged_at,
          closed_at,
          html_url,
          additions,
          deletions,
          changed_files,
          repository_id,
          repositories!inner(
            id,
            name,
            owner,
            full_name
          ),
          contributors:author_id(
            id,
            username,
            avatar_url
          )
        `
        )
        .in('repository_id', repoIds)
        .order('spam_score', { ascending: false, nullsFirst: false });

      // Filter by spam score if not including unanalyzed
      if (!includeUnanalyzed) {
        query = query.not('spam_score', 'is', null);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Failed to fetch spam data: ${fetchError.message}`);
      }

      // Transform to SpamPullRequest format
      const transformedPRs: SpamPullRequest[] = (data || []).map((pr: DatabaseSpamPR) => {
        const repo = Array.isArray(pr.repositories) ? pr.repositories[0] : pr.repositories;
        const contributor = Array.isArray(pr.contributors) ? pr.contributors[0] : pr.contributors;

        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: (() => {
            if (pr.merged_at) return 'merged' as const;
            if (pr.state === 'closed') return 'closed' as const;
            if (pr.draft) return 'draft' as const;
            return 'open' as const;
          })(),
          spam_score: pr.spam_score ?? 0,
          spam_flags: pr.spam_flags,
          is_spam: pr.is_spam ?? false,
          spam_detected_at: pr.spam_detected_at,
          repository: {
            name: repo?.name || 'unknown',
            owner: repo?.owner || 'unknown',
            full_name: repo?.full_name || 'unknown/unknown',
          },
          author: {
            username: contributor?.username || 'unknown',
            avatar_url: contributor?.avatar_url || '',
          },
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          merged_at: pr.merged_at,
          closed_at: pr.closed_at,
          html_url: pr.html_url,
          additions: pr.additions ?? 0,
          deletions: pr.deletions ?? 0,
          changed_files: pr.changed_files ?? 0,
        };
      });

      setAllPullRequests(transformedPRs);
    } catch (err) {
      console.error('Error fetching spam data: %s', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch spam data');
      setAllPullRequests([]);
    } finally {
      setLoading(false);
    }
  }, [repositories, selectedRepositories, includeUnanalyzed]);

  // Filter PRs by spam score range
  const pullRequests = useMemo(() => {
    return allPullRequests.filter((pr) => {
      if (pr.spam_score === null || pr.spam_score === undefined) {
        return includeUnanalyzed;
      }
      return pr.spam_score >= minSpamScore && pr.spam_score <= maxSpamScore;
    });
  }, [allPullRequests, minSpamScore, maxSpamScore, includeUnanalyzed]);

  // Calculate spam stats
  const stats = useMemo((): SpamStats | null => {
    const analyzed = allPullRequests.filter(
      (pr) => pr.spam_score !== null && pr.spam_score !== undefined
    );

    if (analyzed.length === 0) return null;

    const distribution = {
      legitimate: 0,
      warning: 0,
      likelySpam: 0,
      definiteSpam: 0,
    };

    let totalScore = 0;
    let spamCount = 0;

    analyzed.forEach((pr) => {
      totalScore += pr.spam_score;

      if (pr.spam_score <= 25) {
        distribution.legitimate++;
      } else if (pr.spam_score <= 50) {
        distribution.warning++;
      } else if (pr.spam_score <= 75) {
        distribution.likelySpam++;
        spamCount++;
      } else {
        distribution.definiteSpam++;
        spamCount++;
      }
    });

    return {
      totalAnalyzed: analyzed.length,
      spamCount,
      spamPercentage: Math.round((spamCount / analyzed.length) * 100),
      averageScore: Math.round(totalScore / analyzed.length),
      distribution,
    };
  }, [allPullRequests]);

  // Update spam status for a PR
  const updateSpamStatus = useCallback(async (prId: string, isSpam: boolean) => {
    try {
      const supabase = await getSupabase();

      const { error: updateError } = await supabase
        .from('pull_requests')
        .update({
          is_spam: isSpam,
          spam_detected_at: new Date().toISOString(),
        })
        .eq('id', prId);

      if (updateError) {
        throw new Error(`Failed to update spam status: ${updateError.message}`);
      }

      // Update local state
      setAllPullRequests((prev) =>
        prev.map((pr) =>
          pr.id === prId
            ? { ...pr, is_spam: isSpam, spam_detected_at: new Date().toISOString() }
            : pr
        )
      );
    } catch (err) {
      console.error('Error updating spam status: %s', err);
      throw err;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSpamData();
  }, [fetchSpamData]);

  return {
    pullRequests,
    stats,
    loading,
    error,
    refresh: fetchSpamData,
    updateSpamStatus,
  };
}
