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
  author_login: string;
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
  contributors: {
    username: string;
    avatar_url: string;
  } | null;
  repositories: RepositoryData;
}

interface DiscussionRow {
  id: string;
  number: number;
  title: string;
  updated_at: string;
  is_answered: boolean;
  repository_id: string;
  author_login: string | null;
  repositories: RepositoryData;
}

interface CommentRow {
  id: string;
  created_at: string;
  body: string;
  comment_type: string;
  pull_request_id: string;
  pull_requests: {
    number: number;
    title: string;
    state: string;
    merged: boolean;
    repository_id: string;
    repositories: RepositoryData;
  };
}

interface DiscussionCommentRow {
  id: string;
  created_at: string;
  body: string;
  discussion_id: string;
  discussions: {
    number: number;
    title: string;
    is_answered: boolean;
    repository_id: string;
    repositories: RepositoryData;
  };
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function fetchMyWork() {
      if (!user?.user_metadata?.user_name) {
        setLoading(false);
        return;
      }

      // Guard: Only fetch if workspace ID is provided
      // Prevents data leakage by ensuring queries are scoped to a workspace
      if (!workspaceId) {
        setLoading(false);
        setItems([]);
        setTotalCount(0);
        return;
      }

      try {
        setLoading(true);
        const githubLogin = user.user_metadata.user_name;
        const authUserId = user.id; // Get the auth.users.id for responded_by filtering

        // Starting fetch for workspace

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
          // No contributor found for user
          setItems([]);
          setLoading(false);
          return;
        }

        // Found contributor

        // Get workspace repository IDs for filtering
        let workspaceRepoIds: string[] = [];
        if (workspaceId) {
          const { data: workspaceRepos } = await supabase
            .from('workspace_repositories')
            .select('repository_id')
            .eq('workspace_id', workspaceId);

          // Workspace found

          if (workspaceRepos && workspaceRepos.length > 0) {
            workspaceRepoIds = workspaceRepos.map((wr) => wr.repository_id);
            // Filtering by repository IDs
          } else {
            // No repositories in workspace, return empty
            // No repositories in workspace
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
            author_login,
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
        // Exclude issues that have been marked as responded
        let issueQuery = supabase
          .from('issues')
          .select(
            `
            id,
            number,
            title,
            state,
            updated_at,
            assignees,
            repository_id,
            contributors:author_id(username, avatar_url),
            repositories!inner(full_name, owner, name)
          `
          )
          .eq('state', 'open') // Only open issues need attention
          .is('responded_by', null) // Exclude responded items
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

        // Query 3: ALL unanswered discussions in workspace (not just authored by user)
        // Maintainers should see all discussions needing answers
        // Exclude discussions that have been marked as responded
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
            author_login,
            repositories!inner(full_name, owner, name)
          `
          )
          .eq('is_answered', false) // Only unanswered discussions need attention
          .is('responded_by', null) // Exclude responded items
          .order('updated_at', { ascending: false })
          .limit(20);

        if (workspaceRepoIds.length > 0) {
          discussionsQuery = discussionsQuery.in('repository_id', workspaceRepoIds);
        }

        const { data: rawDiscussions, error: discussionsError } = await discussionsQuery;

        if (discussionsError) {
          console.error('Error fetching discussions:', discussionsError);
        }

        // Query 4: Issues with follow-up activity (user has responded, now they've replied)
        // Only show if updated_at is after responded_at
        let followUpIssueQuery = supabase
          .from('issues')
          .select(
            `
            id,
            number,
            title,
            state,
            updated_at,
            responded_at,
            assignees,
            repository_id,
            contributors:author_id(username, avatar_url),
            repositories(full_name, owner, name)
          `
          )
          .eq('responded_by', authUserId) // Only items user has responded to
          .order('updated_at', { ascending: false })
          .limit(20);

        if (workspaceRepoIds.length > 0) {
          followUpIssueQuery = followUpIssueQuery.in('repository_id', workspaceRepoIds);
        }

        const { data: rawFollowUpIssues, error: followUpIssueError } = await followUpIssueQuery;

        if (followUpIssueError) {
          console.error('Error fetching follow-up issues:', followUpIssueError);
        }

        // Query 5: PRs with follow-up activity (user has responded, now they've updated)
        let followUpPRQuery = supabase
          .from('pull_requests')
          .select(
            `
            id,
            number,
            title,
            state,
            merged,
            updated_at,
            responded_at,
            repository_id,
            reviewer_data,
            author_login,
            repositories(full_name, owner, name)
          `
          )
          .eq('responded_by', authUserId) // Only items user has responded to
          .order('updated_at', { ascending: false })
          .limit(20);

        if (workspaceRepoIds.length > 0) {
          followUpPRQuery = followUpPRQuery.in('repository_id', workspaceRepoIds);
        }

        const { data: rawFollowUpPRs, error: followUpPRError } = await followUpPRQuery;

        if (followUpPRError) {
          console.error('Error fetching follow-up PRs:', followUpPRError);
        }

        // Query 6: Discussions with follow-up activity (user has responded, now they've replied)
        let followUpDiscussionQuery = supabase
          .from('discussions')
          .select(
            `
            id,
            number,
            title,
            updated_at,
            responded_at,
            is_answered,
            repository_id,
            author_login,
            repositories(full_name, owner, name)
          `
          )
          .eq('responded_by', authUserId) // Only items user has responded to
          .order('updated_at', { ascending: false })
          .limit(20);

        if (workspaceRepoIds.length > 0) {
          followUpDiscussionQuery = followUpDiscussionQuery.in('repository_id', workspaceRepoIds);
        }

        const { data: rawFollowUpDiscussions, error: followUpDiscussionError } =
          await followUpDiscussionQuery;

        if (followUpDiscussionError) {
          console.error('Error fetching follow-up discussions:', followUpDiscussionError);
        }

        // Query 7: User's recent PR/issue comments
        // Fetch all user comments, then filter by workspace client-side
        // (PostgREST doesn't support filtering on nested join columns)
        const userCommentsQuery = supabase
          .from('comments')
          .select(
            `
            id,
            created_at,
            body,
            comment_type,
            pull_request_id,
            pull_requests!inner(
              number,
              title,
              state,
              merged,
              repository_id,
              repositories(full_name, owner, name)
            )
          `
          )
          .eq('commenter_id', contributor.id)
          .order('created_at', { ascending: false })
          .limit(100);

        const { data: rawUserComments, error: userCommentsError } = await userCommentsQuery;

        if (userCommentsError) {
          console.error('Error fetching user comments:', userCommentsError);
        }

        console.log(`Found ${rawUserComments?.length || 0} total user comments`);
        console.log('Workspace repo IDs to filter:', workspaceRepoIds);

        // Query 8: User's recent discussion comments
        // Fetch all user comments, then filter by workspace client-side
        const userDiscussionCommentsQuery = supabase
          .from('discussion_comments')
          .select(
            `
            id,
            created_at,
            body,
            discussion_id,
            discussions!inner(
              number,
              title,
              is_answered,
              repository_id,
              repositories(full_name, owner, name)
            )
          `
          )
          .eq('author_login', githubLogin)
          .order('created_at', { ascending: false })
          .limit(100);

        const { data: rawUserDiscussionComments, error: userDiscussionCommentsError } =
          await userDiscussionCommentsQuery;

        if (userDiscussionCommentsError) {
          console.error('Error fetching user discussion comments:', userDiscussionCommentsError);
        }

        console.log(
          `Found ${rawUserDiscussionComments?.length || 0} total user discussion comments`
        );

        // Type assertions for Supabase join responses
        const reviewPrs = rawReviewPrs as unknown as PullRequestRow[] | null;
        const allIssues = rawIssues as unknown as IssueRow[] | null;
        const allDiscussions = rawDiscussions as unknown as DiscussionRow[] | null;
        const followUpIssues = rawFollowUpIssues as unknown as
          | (IssueRow & { responded_at: string })[]
          | null;
        const followUpPRs = rawFollowUpPRs as unknown as
          | (PullRequestRow & { responded_at: string })[]
          | null;
        const followUpDiscussions = rawFollowUpDiscussions as unknown as
          | (DiscussionRow & { responded_at: string })[]
          | null;
        const userComments = rawUserComments as unknown as CommentRow[] | null;
        const userDiscussionComments = rawUserDiscussionComments as unknown as
          | DiscussionCommentRow[]
          | null;

        // Query results collected

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

        // Fetch avatars for discussions and PRs (they use author_login directly, not foreign key)
        // Collect unique author logins
        const authorLogins = new Set<string>();

        // Add authors from regular discussions
        allDiscussions?.forEach((discussion) => {
          if (discussion.author_login) {
            authorLogins.add(discussion.author_login);
          }
        });

        // Add authors from follow-up discussions
        followUpDiscussions?.forEach((discussion) => {
          if (discussion.author_login) {
            authorLogins.add(discussion.author_login);
          }
        });

        // Add authors from PRs
        reviewPrs?.forEach((pr) => {
          if (pr.author_login) {
            authorLogins.add(pr.author_login);
          }
        });

        // Add authors from follow-up PRs
        followUpPRs?.forEach((pr) => {
          if (pr.author_login) {
            authorLogins.add(pr.author_login);
          }
        });

        // Fetch avatar URLs for all authors
        let authorAvatarMap = new Map<string, string>();
        if (authorLogins.size > 0) {
          const { data: avatarData } = await supabase
            .from('contributors')
            .select('username, avatar_url')
            .in('username', Array.from(authorLogins));

          if (avatarData) {
            authorAvatarMap = new Map(avatarData.map((c) => [c.username, c.avatar_url]));
          }
        }

        // Map review requested PRs to MyWorkItem
        // Note: PR author_login comes directly from pull_requests table
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
              username: pr.author_login,
              avatar_url: pr.author_login ? authorAvatarMap.get(pr.author_login) : undefined,
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
              username: issue.contributors?.username || 'Unknown',
              avatar_url: issue.contributors?.avatar_url,
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
              username: discussion.author_login || 'Unknown',
              avatar_url: discussion.author_login
                ? authorAvatarMap.get(discussion.author_login)
                : undefined,
            },
          })) || [];

        // Filter follow-up issues where updated_at > responded_at (new activity after response)
        const activeFollowUpIssues = followUpIssues?.filter((issue) => {
          const updatedDate = new Date(issue.updated_at).getTime();
          const respondedDate = new Date(issue.responded_at).getTime();
          return updatedDate > respondedDate;
        });

        // Map follow-up issues to MyWorkItem
        const followUpIssueItems: MyWorkItem[] =
          activeFollowUpIssues?.map((issue) => ({
            id: `follow-up-issue-${issue.id}`,
            type: 'issue' as const,
            itemType: 'follow_up' as const,
            title: issue.title,
            repository: issue.repositories.full_name,
            status: (issue.state as 'open' | 'closed') || 'open',
            url: `https://github.com/${issue.repositories.owner}/${issue.repositories.name}/issues/${issue.number}`,
            updated_at: issue.updated_at,
            responded_at: issue.responded_at,
            needsAttention: true,
            number: issue.number,
            user: {
              username: issue.contributors?.username || 'Unknown',
              avatar_url: issue.contributors?.avatar_url,
            },
          })) || [];

        // Filter follow-up PRs where updated_at > responded_at
        const activeFollowUpPRs = followUpPRs?.filter((pr) => {
          const updatedDate = new Date(pr.updated_at).getTime();
          const respondedDate = new Date(pr.responded_at).getTime();
          return updatedDate > respondedDate;
        });

        // Map follow-up PRs to MyWorkItem
        // Note: PR author_login comes directly from pull_requests table
        const followUpPRItems: MyWorkItem[] =
          activeFollowUpPRs?.map((pr) => ({
            id: `follow-up-pr-${pr.id}`,
            type: 'pr' as const,
            itemType: 'follow_up' as const,
            title: pr.title,
            repository: pr.repositories.full_name,
            status: (pr.state as 'open' | 'closed' | 'merged') || 'open',
            url: `https://github.com/${pr.repositories.owner}/${pr.repositories.name}/pull/${pr.number}`,
            updated_at: pr.updated_at,
            responded_at: pr.responded_at,
            needsAttention: true,
            number: pr.number,
            user: {
              username: pr.author_login,
              avatar_url: pr.author_login ? authorAvatarMap.get(pr.author_login) : undefined,
            },
          })) || [];

        // Filter follow-up discussions where updated_at > responded_at
        const activeFollowUpDiscussions = followUpDiscussions?.filter((discussion) => {
          const updatedDate = new Date(discussion.updated_at).getTime();
          const respondedDate = new Date(discussion.responded_at).getTime();
          return updatedDate > respondedDate;
        });

        // Map follow-up discussions to MyWorkItem
        const followUpDiscussionItems: MyWorkItem[] =
          activeFollowUpDiscussions?.map((discussion) => ({
            id: `follow-up-discussion-${discussion.id}`,
            type: 'discussion' as const,
            itemType: 'follow_up' as const,
            title: discussion.title,
            repository: discussion.repositories.full_name,
            status: 'open' as const,
            url: `https://github.com/${discussion.repositories.owner}/${discussion.repositories.name}/discussions/${discussion.number}`,
            updated_at: discussion.updated_at,
            responded_at: discussion.responded_at,
            needsAttention: true,
            number: discussion.number,
            user: {
              username: discussion.author_login || 'Unknown',
              avatar_url: discussion.author_login
                ? authorAvatarMap.get(discussion.author_login)
                : undefined,
            },
          })) || [];

        // Filter and map user comments (PR/issue comments) to MyWorkItem
        const filteredUserComments = userComments?.filter((comment) => {
          if (!comment.pull_requests) return false;
          if (workspaceRepoIds.length === 0) return true;
          return workspaceRepoIds.includes(comment.pull_requests.repository_id);
        });

        console.log(`After workspace filter: ${filteredUserComments?.length || 0} user comments`);
        if (filteredUserComments && filteredUserComments.length > 0) {
          console.log('Sample filtered comment:', {
            repo: filteredUserComments[0].pull_requests.repositories.full_name,
            created: filteredUserComments[0].created_at,
            pr: filteredUserComments[0].pull_requests.number,
          });
        }

        const userCommentItems: MyWorkItem[] =
          filteredUserComments?.map((comment) => {
            const pr = comment.pull_requests;
            const isPR = comment.comment_type === 'review_comment' || pr.state !== 'closed';
            const status = pr.merged ? 'merged' : (pr.state as 'open' | 'closed');

            return {
              id: `my-comment-${comment.id}`,
              type: isPR ? ('pr' as const) : ('issue' as const),
              itemType: 'my_comment' as const,
              title: pr.title,
              repository: pr.repositories.full_name,
              status,
              url: `https://github.com/${pr.repositories.owner}/${pr.repositories.name}/${isPR ? 'pull' : 'issues'}/${pr.number}#issuecomment-${comment.id}`,
              updated_at: comment.created_at,
              needsAttention: false,
              number: pr.number,
              user: {
                username: githubLogin,
                avatar_url: contributor.avatar_url || undefined,
              },
            };
          }) || [];

        // Filter and map user discussion comments to MyWorkItem
        const filteredDiscussionComments = userDiscussionComments?.filter((comment) => {
          if (!comment.discussions) return false;
          if (workspaceRepoIds.length === 0) return true;
          return workspaceRepoIds.includes(comment.discussions.repository_id);
        });

        console.log(
          `After workspace filter: ${filteredDiscussionComments?.length || 0} discussion comments`
        );

        const userDiscussionCommentItems: MyWorkItem[] =
          filteredDiscussionComments?.map((comment) => {
            const discussion = comment.discussions;
            return {
              id: `my-discussion-comment-${comment.id}`,
              type: 'discussion' as const,
              itemType: 'my_comment' as const,
              title: discussion.title,
              repository: discussion.repositories.full_name,
              status: discussion.is_answered ? ('answered' as const) : ('open' as const),
              url: `https://github.com/${discussion.repositories.owner}/${discussion.repositories.name}/discussions/${discussion.number}#discussioncomment-${comment.id}`,
              updated_at: comment.created_at,
              needsAttention: false,
              number: discussion.number,
              user: {
                username: githubLogin,
                avatar_url: contributor.avatar_url || undefined,
              },
            };
          }) || [];

        // Combine and sort by updated_at
        const allItems = [
          ...reviewPrItems,
          ...issueItems,
          ...discussionItems,
          ...followUpIssueItems,
          ...followUpPRItems,
          ...followUpDiscussionItems,
          ...userCommentItems,
          ...userDiscussionCommentItems,
        ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        // Processed items needing attention

        // Set total count
        setTotalCount(allItems.length);

        // Paginate items
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedItems = allItems.slice(startIndex, endIndex);

        // Showing paginated items

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
  }, [user, workspaceId, page, itemsPerPage, refreshTrigger]);

  const refresh = () => setRefreshTrigger((prev) => prev + 1);

  return { items, totalCount, loading, error, refresh };
}
