import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from './use-current-user';
import type { MyWorkItem } from '@/components/features/workspace';

interface RepositoryData {
  full_name: string;
  owner: string;
  name: string;
}

interface GitHubAssignee {
  login: string;
  avatar_url?: string;
  id?: number;
}

interface PullRequestRow {
  id: string;
  number: number;
  title: string;
  state: string;
  merged: boolean;
  updated_at: string;
  repository: RepositoryData;
}

interface IssueRow {
  id: string;
  number: number;
  title: string;
  state: string;
  updated_at: string;
  assignees: GitHubAssignee[] | null;
  repository: RepositoryData;
}

/**
 * Hook to fetch the current user's work items (PRs and issues)
 */
export function useMyWork(workspaceId?: string) {
  const { user } = useCurrentUser();
  const [items, setItems] = useState<MyWorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchMyWork() {
      if (!user?.user_metadata?.user_name) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const githubLogin = user.user_metadata.user_name;

        // First, get the contributor ID
        const { data: contributor, error: contributorError } = await supabase
          .from('contributors')
          .select('id')
          .eq('github_login', githubLogin)
          .maybeSingle();

        if (contributorError) {
          console.error('Error fetching contributor:', contributorError);
          setError(contributorError);
          setLoading(false);
          return;
        }

        if (!contributor) {
          console.log('No contributor found for user:', githubLogin);
          setItems([]);
          setLoading(false);
          return;
        }

        const contributorId = contributor.id;

        // Build base query for PRs
        let prQuery = supabase
          .from('pull_requests')
          .select(
            `
            id,
            number,
            title,
            state,
            merged,
            updated_at,
            repository:repositories!inner(full_name, owner, name)
          `
          )
          .eq('author_id', contributorId)
          .order('updated_at', { ascending: false })
          .limit(10);

        // If workspace is specified, filter by workspace repositories
        if (workspaceId) {
          const { data: workspaceRepos } = await supabase
            .from('workspace_repositories')
            .select('repository_id')
            .eq('workspace_id', workspaceId);

          if (workspaceRepos && workspaceRepos.length > 0) {
            const repoIds = workspaceRepos.map((wr) => wr.repository_id);
            prQuery = prQuery.in('repository_id', repoIds);
          }
        }

        const { data: rawPrs, error: prError } = await prQuery;

        if (prError) {
          console.error('Error fetching PRs:', prError);
          setError(prError);
        }

        // Type assertion for Supabase join response
        const prs = rawPrs as unknown as PullRequestRow[] | null;

        // Build base query for issues
        let issueQuery = supabase
          .from('github_issues')
          .select(
            `
            id,
            number,
            title,
            state,
            updated_at,
            assignees,
            repository:repositories!inner(full_name, owner, name)
          `
          )
          .order('updated_at', { ascending: false })
          .limit(10);

        // Filter issues where user is in assignees
        // Note: This is a basic filter - in production you'd want to use a more robust JSONB query
        if (workspaceId) {
          const { data: workspaceRepos } = await supabase
            .from('workspace_repositories')
            .select('repository_id')
            .eq('workspace_id', workspaceId);

          if (workspaceRepos && workspaceRepos.length > 0) {
            const repoIds = workspaceRepos.map((wr) => wr.repository_id);
            issueQuery = issueQuery.in('repository_id', repoIds);
          }
        }

        const { data: rawIssues, error: issueError } = await issueQuery;

        if (issueError) {
          console.error('Error fetching issues:', issueError);
          setError(issueError);
        }

        // Type assertion for Supabase join response
        const allIssues = rawIssues as unknown as IssueRow[] | null;

        // Filter issues where the user is assigned (client-side filtering for JSONB)
        const issues = allIssues?.filter((issue) => {
          if (!issue.assignees || issue.assignees.length === 0) return false;
          return issue.assignees.some((assignee: GitHubAssignee) => assignee.login === githubLogin);
        });

        // Helper to determine PR status
        const getPRStatus = (state: string, merged: boolean): 'open' | 'merged' | 'closed' => {
          if (state === 'open') return 'open';
          if (merged) return 'merged';
          return 'closed';
        };

        // Map PRs to MyWorkItem
        const prItems: MyWorkItem[] =
          prs?.map((pr) => ({
            id: `pr-${pr.id}`,
            type: 'pr' as const,
            title: pr.title,
            repository: pr.repository.full_name,
            status: getPRStatus(pr.state, pr.merged),
            url: `https://github.com/${pr.repository.owner}/${pr.repository.name}/pull/${pr.number}`,
            updated_at: pr.updated_at,
            needsAttention: pr.state === 'open',
          })) || [];

        // Map issues to MyWorkItem
        const issueItems: MyWorkItem[] =
          issues?.map((issue) => ({
            id: `issue-${issue.id}`,
            type: 'issue' as const,
            title: issue.title,
            repository: issue.repository.full_name,
            status: issue.state as 'open' | 'closed',
            url: `https://github.com/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`,
            updated_at: issue.updated_at,
            needsAttention: issue.state === 'open',
          })) || [];

        // Combine and sort by updated_at
        const allItems = [...prItems, ...issueItems].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        setItems(allItems);
        setError(null);
      } catch (err) {
        console.error('Error in fetchMyWork:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchMyWork();
  }, [user, workspaceId]);

  return { items, loading, error };
}
