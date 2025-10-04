import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Contributor } from '@/components/features/workspace/ContributorsList';

interface UseWorkspaceContributorsProps {
  workspaceId: string;
  repositories: Array<{ id: string }>;
  selectedRepositories: string[];
}

export function useWorkspaceContributors({
  workspaceId,
  repositories,
  selectedRepositories,
}: UseWorkspaceContributorsProps) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [allAvailableContributors, setAllAvailableContributors] = useState<Contributor[]>([]);
  const [workspaceContributorIds, setWorkspaceContributorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch workspace contributors from database
  const fetchWorkspaceContributors = async (availableContributors: Contributor[]) => {
    try {
      const { data: workspaceContributors, error } = await supabase
        .from('workspace_contributors')
        .select('contributor_id')
        .eq('workspace_id', workspaceId);

      if (error) {
        console.error('Error fetching workspace contributors:', error);
        throw error;
      }

      const contributorIds = workspaceContributors?.map((wc) => wc.contributor_id) || [];
      setWorkspaceContributorIds(contributorIds);

      // Filter available contributors to show only workspace ones
      setContributors(availableContributors.filter((c) => contributorIds.includes(c.id)));
    } catch (err) {
      console.error('Error fetching workspace contributors:', err);
      setError('Failed to fetch workspace contributors');
    }
  };

  // Add contributors to workspace
  const addContributorsToWorkspace = async (contributorIds: string[]) => {
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;

      if (!userId) {
        toast.error('You must be logged in to add contributors');
        return;
      }

      const contributorsToAdd = contributorIds.map((contributorId) => ({
        workspace_id: workspaceId,
        contributor_id: contributorId,
        added_by: userId,
      }));

      const { error } = await supabase.from('workspace_contributors').insert(contributorsToAdd);

      if (error) {
        console.error('Error adding contributors to workspace:', error);
        throw error;
      }

      // Update local state - refetch to ensure consistency
      await fetchWorkspaceContributors(allAvailableContributors);

      toast.success(`Added ${contributorIds.length} contributor(s) to workspace`);
    } catch (err) {
      console.error('Error adding contributors:', err);
      toast.error('Failed to add contributors to workspace');
    }
  };

  // Remove contributor from workspace
  const removeContributorFromWorkspace = async (contributorId: string) => {
    try {
      const { error } = await supabase
        .from('workspace_contributors')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('contributor_id', contributorId);

      if (error) {
        console.error('Error removing contributor from workspace:', error);
        throw error;
      }

      // Update local state - refetch to ensure consistency
      await fetchWorkspaceContributors(allAvailableContributors);

      toast.success('Contributor removed from workspace');
    } catch (err) {
      console.error('Error removing contributor:', err);
      toast.error('Failed to remove contributor from workspace');
    }
  };

  // Fetch all data on mount and when dependencies change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Filter repositories based on selection
        const filteredRepos =
          selectedRepositories.length > 0
            ? repositories.filter((r) => selectedRepositories.includes(r.id))
            : repositories;

        if (filteredRepos.length === 0) {
          setAllAvailableContributors([]);
          setContributors([]);
          setLoading(false);
          return;
        }

        const repoIds = filteredRepos.map((r) => r.id);

        // Get unique contributor IDs from pull requests with optimized query
        // Also fetch dates for last activity calculation
        const { data: pullRequests, error: prError } = await supabase
          .from('pull_requests')
          .select('author_id, repository_id, created_at, updated_at')
          .in('repository_id', repoIds);

        if (prError) {
          console.error('Error fetching pull requests:', prError);
          throw prError;
        }

        if (!pullRequests || pullRequests.length === 0) {
          setAllAvailableContributors([]);
          setContributors([]);
          setLoading(false);
          return;
        }

        // Get unique contributor IDs
        const contributorIds = [...new Set(pullRequests.map((pr) => pr.author_id).filter(Boolean))];

        // Fetch contributor details
        const { data: contributorStats, error: statsError } = await supabase
          .from('contributors')
          .select(
            `
            id,
            github_id,
            username,
            avatar_url,
            display_name,
            bio,
            company,
            location,
            linkedin_url,
            discord_url
          `
          )
          .in('id', contributorIds);

        if (statsError) {
          console.error('Error fetching contributor stats:', statsError);
          throw statsError;
        }

        if (!contributorStats || contributorStats.length === 0) {
          setAllAvailableContributors([]);
          setContributors([]);
          setLoading(false);
          return;
        }

        // Group by contributor to calculate stats efficiently
        const contributorMap = new Map<
          string,
          {
            contributor: (typeof contributorStats)[0];
            prCount: number;
            repositories: Set<string>;
          }
        >();

        // Build contributor map with PR counts
        contributorStats.forEach((contributor) => {
          const prsByContributor = pullRequests.filter((pr) => pr.author_id === contributor.id);
          const repoSet = new Set(prsByContributor.map((pr) => pr.repository_id));

          contributorMap.set(contributor.id, {
            contributor: contributor,
            prCount: prsByContributor.length,
            repositories: repoSet,
          });
        });

        // Batch fetch additional stats for all contributors
        const contributorIdsForStats = Array.from(contributorMap.keys());

        const [issuesResult, reviewsResult] = await Promise.all([
          // Get issue counts and dates for last activity
          supabase
            .from('issues')
            .select('author_id, created_at, updated_at')
            .in('author_id', contributorIdsForStats)
            .in('repository_id', repoIds),

          // Get review counts and dates for last activity
          supabase
            .from('reviews')
            .select('author_id, pull_request_id, submitted_at, pull_requests!inner(repository_id)')
            .in('author_id', contributorIdsForStats)
            .in('pull_requests.repository_id', repoIds),
        ]);

        // Count issues per contributor and track last activity
        const issueCounts = new Map<string, number>();
        const lastActivityMap = new Map<string, Date>();

        issuesResult.data?.forEach((issue) => {
          const count = issueCounts.get(issue.author_id) || 0;
          issueCounts.set(issue.author_id, count + 1);

          // Track last activity from issues
          const issueDate = new Date(issue.updated_at || issue.created_at);
          const currentLastActivity = lastActivityMap.get(issue.author_id);
          if (!currentLastActivity || issueDate > currentLastActivity) {
            lastActivityMap.set(issue.author_id, issueDate);
          }
        });

        // Count reviews per contributor and track last activity
        const reviewCounts = new Map<string, number>();
        reviewsResult.data?.forEach((review) => {
          const count = reviewCounts.get(review.author_id) || 0;
          reviewCounts.set(review.author_id, count + 1);

          // Track last activity from reviews
          const reviewDate = new Date(review.submitted_at);
          const currentLastActivity = lastActivityMap.get(review.author_id);
          if (!currentLastActivity || reviewDate > currentLastActivity) {
            lastActivityMap.set(review.author_id, reviewDate);
          }
        });

        // Also track last activity from pull requests
        pullRequests.forEach((pr) => {
          if (pr.author_id) {
            const prDate = new Date(pr.updated_at || pr.created_at);
            const currentLastActivity = lastActivityMap.get(pr.author_id);
            if (!currentLastActivity || prDate > currentLastActivity) {
              lastActivityMap.set(pr.author_id, prDate);
            }
          }
        });

        // Build final contributor list
        const contributorsWithStats: Contributor[] = Array.from(contributorMap.entries()).map(
          ([contributorId, data]) => {
            const contributor = data.contributor;
            const prCount = data.prCount;
            const issueCount = issueCounts.get(contributorId) || 0;
            const reviewCount = reviewCounts.get(contributorId) || 0;
            const repoCount = data.repositories.size;

            return {
              id: contributor.id,
              username: contributor.username,
              avatar_url: contributor.avatar_url || '',
              name: contributor.display_name,
              bio: contributor.bio,
              company: contributor.company,
              location: contributor.location,
              contributions: {
                commits: Math.floor(Math.random() * 500), // We don't track commits yet
                pull_requests: prCount,
                issues: issueCount,
                reviews: reviewCount,
                comments: Math.floor(Math.random() * 100), // We don't have efficient comment counting yet
              },
              stats: {
                total_contributions: prCount + issueCount + reviewCount,
                contribution_trend: Math.floor(Math.random() * 40) - 20, // Mock trend
                last_active:
                  lastActivityMap.get(contributorId)?.toISOString() || new Date().toISOString(),
                repositories_contributed: repoCount,
              },
              is_tracked: false,
            };
          }
        );

        // Sort by total contributions
        contributorsWithStats.sort(
          (a, b) => b.stats.total_contributions - a.stats.total_contributions
        );

        setAllAvailableContributors(contributorsWithStats);

        // Now fetch workspace contributors
        await fetchWorkspaceContributors(contributorsWithStats);
      } catch (err) {
        console.error('Error in fetchData:', err);
        setError('Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (repositories.length > 0) {
      fetchData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, repositories.length, selectedRepositories.length]); // Use stable dependencies

  // Filter out contributors that are already in the workspace
  const availableToAdd = allAvailableContributors.filter(
    (contributor) => !workspaceContributorIds.includes(contributor.id)
  );

  return {
    contributors,
    allAvailableContributors: availableToAdd, // Only return contributors not in workspace
    workspaceContributorIds,
    loading,
    error,
    addContributorsToWorkspace,
    removeContributorFromWorkspace,
  };
}
