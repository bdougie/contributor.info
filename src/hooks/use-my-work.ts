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
  repository_id: string;
  repositories: RepositoryData;
}

interface IssueRow {
  id: string;
  number: number;
  title: string;
  state: string;
  updated_at: string;
  assignees: GitHubAssignee[] | null;
  repository_id: string;
  repositories: RepositoryData;
}

interface DiscussionRow {
  id: string;
  number: number;
  title: string;
  updated_at: string;
  is_answered: boolean;
  repository_id: string;
  repositories: RepositoryData;
}

/**
 * Hook to fetch the current user's work items (PRs, issues, and discussions)
 */
export function useMyWork(workspaceId?: string, page = 1, itemsPerPage = 10) {
  const { user } = useCurrentUser();
  const [items, setItems] = useState<MyWorkItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
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
          .eq('username', githubLogin)
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
        console.log('Found contributor:', { contributorId, githubLogin });

        // Get workspace repository IDs for filtering
        let workspaceRepoIds: string[] = [];
        if (workspaceId) {
          const { data: workspaceRepos } = await supabase
            .from('workspace_repositories')
            .select('repository_id')
            .eq('workspace_id', workspaceId);

          console.log('Workspace repositories:', workspaceRepos?.length || 0);

          if (workspaceRepos && workspaceRepos.length > 0) {
            workspaceRepoIds = workspaceRepos.map((wr) => wr.repository_id);
            console.log('Filtering by repository IDs:', workspaceRepoIds);
          } else {
            // No repositories in workspace, return empty
            console.log('No repositories in workspace');
            setItems([]);
            setLoading(false);
            return;
          }
        }

        // Query 1: PRs where user is requested as reviewer
        // Note: This requires requested_reviewers JSONB field in pull_requests table
        let reviewRequestedPRQuery = supabase
          .from('pull_requests')
          .select(
            `
            id,
            number,
            title,
            state,
            merged,
            updated_at,
            repository_id,
            requested_reviewers,
            repositories!inner(full_name, owner, name)
          `
          )
          .eq('state', 'open') // Only open PRs need reviews
          .order('updated_at', { ascending: false })
          .limit(20);

        if (workspaceRepoIds.length > 0) {
          reviewRequestedPRQuery = reviewRequestedPRQuery.in('repository_id', workspaceRepoIds);
        }

        const { data: rawReviewPrs, error: reviewPrError } = await reviewRequestedPRQuery;

        if (reviewPrError) {
          console.error('Error fetching review PRs:', reviewPrError);
        }

        // Type assertions for Supabase join response
        const reviewPrs = rawReviewPrs as unknown as
          | (PullRequestRow & {
              requested_reviewers: GitHubAssignee[] | null;
            })[]
          | null;

        // Query 2: Open issues assigned to user (in workspace repos)
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
            repository_id,
            repositories!inner(full_name, owner, name)
          `
          )
          .eq('state', 'open') // Only open issues need attention
          .order('updated_at', { ascending: false })
          .limit(20);

        if (workspaceRepoIds.length > 0) {
          issueQuery = issueQuery.in('repository_id', workspaceRepoIds);
        }

        const { data: rawIssues, error: issueError } = await issueQuery;

        if (issueError) {
          console.error('Error fetching issues:', issueError);
          setError(issueError);
        }

        // Query 3: Unanswered discussions where user is author (in workspace repos)
        // Note: discussions table uses author_login (string) not author_id (UUID)
        let discussionsQuery = supabase
          .from('discussions')
          .select(
            `
            id,
            number,
            title,
            updated_at,
            is_answered,
            repository_id,
            repositories!inner(full_name, owner, name)
          `
          )
          .eq('author_login', githubLogin)
          .eq('is_answered', false) // Only unanswered discussions need attention
          .order('updated_at', { ascending: false })
          .limit(20);

        if (workspaceRepoIds.length > 0) {
          discussionsQuery = discussionsQuery.in('repository_id', workspaceRepoIds);
        }

        const { data: rawDiscussions, error: discussionsError } = await discussionsQuery;

        if (discussionsError) {
          console.error('Error fetching discussions:', discussionsError);
        }

        // Type assertions for Supabase join responses
        const allIssues = rawIssues as unknown as IssueRow[] | null;
        const allDiscussions = rawDiscussions as unknown as DiscussionRow[] | null;

        console.log('Query results:', {
          reviewPRs: rawReviewPrs?.length || 0,
          openIssues: allIssues?.length || 0,
          unansweredDiscussions: allDiscussions?.length || 0,
        });

        // Filter issues where the user is assigned (client-side filtering for JSONB)
        const assignedIssues = allIssues?.filter((issue) => {
          if (!issue.assignees || issue.assignees.length === 0) return false;
          return issue.assignees.some((assignee: GitHubAssignee) => assignee.login === githubLogin);
        });

        // Filter review PRs where the user is requested (client-side filtering for JSONB)
        const reviewRequestedPrs = reviewPrs?.filter((pr) => {
          if (!pr.requested_reviewers || pr.requested_reviewers.length === 0) return false;
          return pr.requested_reviewers.some(
            (reviewer: GitHubAssignee) => reviewer.login === githubLogin
          );
        });

        // Map review requested PRs to MyWorkItem
        const reviewPrItems: MyWorkItem[] =
          reviewRequestedPrs?.map((pr) => ({
            id: `review-pr-${pr.id}`,
            type: 'pr' as const,
            itemType: 'review_requested' as const,
            title: pr.title,
            repository: pr.repositories.full_name,
            status: 'open' as const, // Review requests are always open
            url: `https://github.com/${pr.repositories.owner}/${pr.repositories.name}/pull/${pr.number}`,
            updated_at: pr.updated_at,
            needsAttention: true, // Review requests always need attention
            number: pr.number,
          })) || [];

        // Map assigned issues to MyWorkItem
        const issueItems: MyWorkItem[] =
          assignedIssues?.map((issue) => ({
            id: `issue-${issue.id}`,
            type: 'issue' as const,
            itemType: 'assigned' as const,
            title: issue.title,
            repository: issue.repositories.full_name,
            status: 'open' as const, // Only open issues are fetched
            url: `https://github.com/${issue.repositories.owner}/${issue.repositories.name}/issues/${issue.number}`,
            updated_at: issue.updated_at,
            needsAttention: true,
            number: issue.number,
          })) || [];

        // Map unanswered discussions to MyWorkItem
        const discussionItems: MyWorkItem[] =
          allDiscussions?.map((discussion) => ({
            id: `discussion-${discussion.id}`,
            type: 'discussion' as const,
            itemType: 'authored' as const,
            title: discussion.title,
            repository: discussion.repositories.full_name,
            status: 'open' as const, // Only unanswered discussions are fetched
            url: `https://github.com/${discussion.repositories.owner}/${discussion.repositories.name}/discussions/${discussion.number}`,
            updated_at: discussion.updated_at,
            needsAttention: true,
            number: discussion.number,
          })) || [];

        // Combine and sort by updated_at
        const allItems = [...reviewPrItems, ...issueItems, ...discussionItems].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );

        console.log('Processed items needing attention:', {
          reviewPrItems: reviewPrItems.length,
          issueItems: issueItems.length,
          discussionItems: discussionItems.length,
          total: allItems.length,
        });

        // Set total count
        setTotalCount(allItems.length);

        // Paginate items
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedItems = allItems.slice(startIndex, endIndex);

        console.log(
          `Showing items ${startIndex + 1}-${Math.min(endIndex, allItems.length)} of ${allItems.length}`
        );

        setItems(paginatedItems);
        setError(null);
      } catch (err) {
        console.error('Error in fetchMyWork:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchMyWork();
  }, [user, workspaceId, page, itemsPerPage]);

  return { items, totalCount, loading, error };
}
