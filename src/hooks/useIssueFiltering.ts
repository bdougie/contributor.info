import { useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { useWorkspaceFiltersStore } from '@/lib/workspace-filters-store';
import { applyIssueFilters, type Issue } from '@/lib/utils/issue-filters';

/**
 * Hook for filtering issues based on stored filter state
 *
 * This hook separates filtering logic from data fetching, making it
 * reusable across different components and testable in isolation.
 *
 * @param issues - Array of issues to filter
 * @param currentUser - Current authenticated user (required for response filtering)
 * @returns Filtered array of issues
 *
 * @example
 * ```tsx
 * const { issues } = useWorkspaceIssues({ ... });
 * const filteredIssues = useIssueFiltering(issues, currentUser);
 * ```
 */
export function useIssueFiltering(issues: Issue[], currentUser: User | null): Issue[] {
  const { issueStates, issueIncludeBots, issueAssignmentFilter, issueResponseFilter } =
    useWorkspaceFiltersStore();

  return useMemo(() => {
    return applyIssueFilters(
      issues,
      issueStates,
      issueIncludeBots,
      issueAssignmentFilter,
      issueResponseFilter,
      currentUser
    );
  }, [
    issues,
    issueStates,
    issueIncludeBots,
    issueAssignmentFilter,
    issueResponseFilter,
    currentUser,
  ]);
}
