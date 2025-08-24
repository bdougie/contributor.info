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
  selectedRepositories 
}: UseWorkspaceContributorsProps) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [allAvailableContributors, setAllAvailableContributors] = useState<Contributor[]>([]);
  const [workspaceContributorIds, setWorkspaceContributorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch contributors who have made PRs to the selected repositories
  const fetchAvailableContributors = async () => {
    try {
      // Filter repositories based on selection
      const filteredRepos = selectedRepositories.length > 0
        ? repositories.filter(r => selectedRepositories.includes(r.id))
        : repositories;
      
      if (filteredRepos.length === 0) {
        setAllAvailableContributors([]);
        return;
      }
      
      const repoIds = filteredRepos.map(r => r.id);
      
      // Get unique contributor IDs from pull requests with optimized query
      const { data: contributorStats, error: statsError } = await supabase
        .from('pull_requests')
        .select(`
          author_id,
          repository_id,
          contributors!inner(
            id,
            github_id,
            username,
            avatar_url,
            display_name,
            bio,
            company,
            location
          )
        `)
        .in('repository_id', repoIds)
        .not('author_id', 'is', null);

      if (statsError) {
        console.error('Error fetching contributor stats:', statsError);
        throw statsError;
      }

      if (!contributorStats || contributorStats.length === 0) {
        setAllAvailableContributors([]);
        return;
      }

      // Group by contributor to calculate stats efficiently
      const contributorMap = new Map<string, {
        contributor: any;
        prCount: number;
        repositories: Set<string>;
      }>();

      contributorStats.forEach((pr) => {
        if (!pr.contributors || !pr.author_id) return;
        
        const contributorId = pr.author_id;
        if (!contributorMap.has(contributorId)) {
          contributorMap.set(contributorId, {
            contributor: pr.contributors,
            prCount: 0,
            repositories: new Set()
          });
        }
        
        const stats = contributorMap.get(contributorId)!;
        stats.prCount += 1;
        stats.repositories.add(pr.repository_id);
      });

      // Batch fetch additional stats for all contributors
      const contributorIds = Array.from(contributorMap.keys());
      
      const [issuesResult, reviewsResult] = await Promise.all([
        // Get issue counts
        supabase
          .from('issues')
          .select('author_id')
          .in('author_id', contributorIds)
          .in('repository_id', repoIds),
        
        // Get review counts via pull_requests join
        supabase
          .from('reviews')
          .select(`
            author_id,
            pull_requests!inner(repository_id)
          `)
          .in('author_id', contributorIds)
          .in('pull_requests.repository_id', repoIds)
      ]);

      // Count issues per contributor
      const issueCounts = new Map<string, number>();
      issuesResult.data?.forEach(issue => {
        const count = issueCounts.get(issue.author_id) || 0;
        issueCounts.set(issue.author_id, count + 1);
      });

      // Count reviews per contributor
      const reviewCounts = new Map<string, number>();
      reviewsResult.data?.forEach(review => {
        const count = reviewCounts.get(review.author_id) || 0;
        reviewCounts.set(review.author_id, count + 1);
      });

      // Build final contributor list
      const contributorsWithStats: Contributor[] = Array.from(contributorMap.entries()).map(([contributorId, data]) => {
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
            last_active: new Date().toISOString(), // TODO: Get actual last activity
            repositories_contributed: repoCount,
          },
          is_tracked: false,
        };
      });

      // Sort by total contributions
      contributorsWithStats.sort((a, b) => b.stats.total_contributions - a.stats.total_contributions);
      
      setAllAvailableContributors(contributorsWithStats);
    } catch (err) {
      console.error('Error fetching available contributors:', err);
      setError('Failed to fetch contributors');
    }
  };

  // Fetch workspace contributors from database
  const fetchWorkspaceContributors = async () => {
    try {
      const { data: workspaceContributors, error } = await supabase
        .from('workspace_contributors')
        .select('contributor_id')
        .eq('workspace_id', workspaceId);

      if (error) {
        console.error('Error fetching workspace contributors:', error);
        throw error;
      }

      const contributorIds = workspaceContributors?.map(wc => wc.contributor_id) || [];
      setWorkspaceContributorIds(contributorIds);
      
      // Filter available contributors to show only workspace ones
      setContributors(allAvailableContributors.filter(c => contributorIds.includes(c.id)));
    } catch (err) {
      console.error('Error fetching workspace contributors:', err);
      setError('Failed to fetch workspace contributors');
    }
  };

  // Add contributors to workspace
  const addContributorsToWorkspace = async (contributorIds: string[]) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        toast.error('You must be logged in to add contributors');
        return;
      }

      const contributorsToAdd = contributorIds.map(contributorId => ({
        workspace_id: workspaceId,
        contributor_id: contributorId,
        added_by: userId,
      }));

      const { error } = await supabase
        .from('workspace_contributors')
        .insert(contributorsToAdd);

      if (error) {
        console.error('Error adding contributors to workspace:', error);
        throw error;
      }

      // Update local state
      const newIds = [...new Set([...workspaceContributorIds, ...contributorIds])];
      setWorkspaceContributorIds(newIds);
      setContributors(allAvailableContributors.filter(c => newIds.includes(c.id)));
      
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

      // Update local state
      const newIds = workspaceContributorIds.filter(id => id !== contributorId);
      setWorkspaceContributorIds(newIds);
      setContributors(allAvailableContributors.filter(c => newIds.includes(c.id)));
      
      toast.success('Contributor removed from workspace');
    } catch (err) {
      console.error('Error removing contributor:', err);
      toast.error('Failed to remove contributor from workspace');
    }
  };

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        await fetchAvailableContributors();
      } catch (err) {
        console.error('Error in fetchData:', err);
      } finally {
        setLoading(false);
      }
    };

    if (repositories.length > 0) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [workspaceId, repositories, selectedRepositories]);

  // Fetch workspace contributors when available contributors change
  useEffect(() => {
    if (allAvailableContributors.length > 0) {
      fetchWorkspaceContributors();
    }
  }, [allAvailableContributors, workspaceId]);

  return {
    contributors,
    allAvailableContributors,
    workspaceContributorIds,
    loading,
    error,
    addContributorsToWorkspace,
    removeContributorFromWorkspace,
  };
}