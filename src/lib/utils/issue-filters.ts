import type { User } from '@supabase/supabase-js';
import type {
  IssueState,
  IssueAssignmentFilter,
  IssueResponseFilter,
} from '@/lib/workspace-filters-store';
import { isBot } from '@/lib/utils/bot-detection';

/**
 * Issue type matching WorkspaceIssuesTable.Issue interface
 */
export interface Issue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  repository: {
    name: string;
    owner: string;
    avatar_url?: string;
  };
  author: {
    username: string;
    avatar_url: string;
    isBot?: boolean;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments_count: number;
  labels: Array<{
    name: string;
    color: string;
  }>;
  assignees?: Array<{
    login: string;
    avatar_url: string;
  }>;
  linked_pull_requests?: Array<{
    number: number;
    url: string;
    state: 'open' | 'closed' | 'merged';
  }>;
  url: string;
  responded_by?: string | null;
  responded_at?: string | null;
}

/**
 * Filter function for issue state (open/closed)
 */
export function filterByState(selectedStates: IssueState[]) {
  return (issue: Issue): boolean => selectedStates.includes(issue.state as IssueState);
}

/**
 * Filter function for bot authors
 */
export function filterByBot(includeBots: boolean) {
  return (issue: Issue): boolean => {
    const authorIsBot = isBot(issue.author);
    return includeBots || !authorIsBot;
  };
}

/**
 * Filter function for issue assignment status
 */
export function filterByAssignment(assignmentFilter: IssueAssignmentFilter) {
  return (issue: Issue): boolean => {
    if (assignmentFilter === 'all') return true;

    const hasAssignees = issue.assignees !== undefined && issue.assignees.length > 0;

    if (assignmentFilter === 'assigned') {
      return hasAssignees;
    }

    if (assignmentFilter === 'unassigned') {
      return !hasAssignees;
    }

    return true;
  };
}

/**
 * Filter function for response status
 * - 'all': show all issues
 * - 'needs_response': show issues where responded_by is null
 * - 'replied': show issues where current user has responded AND there are comments
 */
export function filterByResponse(responseFilter: IssueResponseFilter, currentUser: User | null) {
  return (issue: Issue): boolean => {
    if (responseFilter === 'all') return true;

    if (responseFilter === 'needs_response') {
      // Show only issues where no one has responded yet
      return !issue.responded_by;
    }

    if (responseFilter === 'replied') {
      // Show only issues where:
      // 1. Current user has responded
      // 2. There are comments (indicating potential replies to the response)
      if (!currentUser) return false;
      const hasResponded = issue.responded_by === currentUser.id;
      const hasComments = issue.comments_count > 0;
      return hasResponded && hasComments;
    }

    return true;
  };
}

/**
 * Apply all filters to an array of issues
 * Combines state, bot, assignment, and response filters
 *
 * @param issues - Array of issues to filter
 * @param selectedStates - Issue states to include
 * @param includeBots - Whether to include issues from bots
 * @param assignmentFilter - Assignment filter type
 * @param responseFilter - Response filter type
 * @param currentUser - Current user (required for response filtering)
 * @returns Filtered array of issues
 */
export function applyIssueFilters(
  issues: Issue[],
  selectedStates: IssueState[],
  includeBots: boolean,
  assignmentFilter: IssueAssignmentFilter,
  responseFilter: IssueResponseFilter,
  currentUser: User | null
): Issue[] {
  return issues
    .filter(filterByState(selectedStates))
    .filter(filterByBot(includeBots))
    .filter(filterByAssignment(assignmentFilter))
    .filter(filterByResponse(responseFilter, currentUser));
}

/**
 * Count issues that need a response
 * Used for tab badge display
 */
export function countNeedsResponse(issues: Issue[]): number {
  return issues.filter((issue) => !issue.responded_by).length;
}

/**
 * Count issues with user's replies that may have follow-up activity
 * Used for tab badge display
 */
export function countReplies(issues: Issue[], currentUser: User | null): number {
  if (!currentUser) return 0;
  return issues.filter((issue) => {
    const hasResponded = issue.responded_by === currentUser.id;
    const hasComments = issue.comments_count > 0;
    return hasResponded && hasComments;
  }).length;
}
