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

interface ReviewerData {
  requested_reviewers?: Array<{
    username: string;
    avatar_url: string;
  }>;
}

interface PullRequestRow {
  id: string;
  number: number;
  title: string;
  state: string;
  merged: boolean;
  updated_at: string;
  repository_id: string;
  reviewer_data: ReviewerData | null;
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

        console.log('useMyWork - Starting fetch for:', { workspaceId, githubLogin });

        // First, get the contributor ID and avatar
        const { data: contributor, error: contributorError } = await supabase
          .from('contributors')
          .select('id, avatar_url')
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
        const avatarUrl = contributor.avatar_url;
        console.log('Found contributor:', { contributorId, githubLogin, avatarUrl });

        // Get workspace repository IDs for filtering
        let workspaceRepoIds: string[] = [];
        if (workspaceId) {
          const { data: workspaceRepos } = await supabase
            .from('workspace_repositories')
            .select('repository_id')
            .eq('workspace_id', workspaceId);

          console.log('useMyWork - Workspace found:', {
            workspaceId,
            repositoryCount: workspaceRepos?.length || 0,
          });

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
        // Note: reviewer_data is a JSONB column with requested_reviewers array
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
            reviewer_data,
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

        // Query 2: ALL unanswered discussions in workspace (not just authored by user)
        // Maintainers should see all discussions needing answers
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
        const reviewPrs = rawReviewPrs as unknown as PullRequestRow[] | null;
        const allIssues = rawIssues as unknown as IssueRow[] | null;
        const allDiscussions = rawDiscussions as unknown as DiscussionRow[] | null;

        console.log('Query results:', {
          reviewPRs: reviewPrs?.length || 0,
          openIssues: allIssues?.length || 0,
          unansweredDiscussions: allDiscussions?.length || 0,
        });

        // Filter review PRs where the user is requested (client-side filtering for JSONB)
        const reviewRequestedPrs = reviewPrs?.filter((pr) => {
          if (!pr.reviewer_data?.requested_reviewers) return false;
          return pr.reviewer_data.requested_reviewers.some(
            (reviewer) => reviewer.username === githubLogin
          );
        });

        // Filter issues where the user is assigned (client-side filtering for JSONB)
        const assignedIssues = allIssues?.filter((issue) => {
          if (!issue.assignees || issue.assignees.length === 0) return false;
          return issue.assignees.some((assignee: GitHubAssignee) => assignee.login === githubLogin);
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
            needsAttention: true,
            number: pr.number,
            user: {
              username: githubLogin,
              avatar_url: avatarUrl,
            },
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
            user: {
              username: githubLogin,
              avatar_url: avatarUrl,
            },
          })) || [];

        // Map unanswered discussions to MyWorkItem
        const discussionItems: MyWorkItem[] =
          allDiscussions?.map((discussion) => ({
            id: `discussion-${discussion.id}`,
            type: 'discussion' as const,
            itemType: 'participant' as const, // All unanswered discussions in workspace
            title: discussion.title,
            repository: discussion.repositories.full_name,
            status: 'open' as const, // Only unanswered discussions are fetched
            url: `https://github.com/${discussion.repositories.owner}/${discussion.repositories.name}/discussions/${discussion.number}`,
            updated_at: discussion.updated_at,
            needsAttention: true,
            number: discussion.number,
            user: {
              username: githubLogin,
              avatar_url: avatarUrl,
            },
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
