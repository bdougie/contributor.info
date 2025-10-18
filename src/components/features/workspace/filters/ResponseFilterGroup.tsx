import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWorkspaceFiltersStore, type IssueResponseFilter } from '@/lib/workspace-filters-store';

/**
 * ResponseFilterGroup Component
 *
 * Provides tabbed filtering for issue response status:
 * - All: show all issues
 * - Needs Response: show only issues requiring response
 * - Replied: show only issues where user has replied
 *
 * This component integrates with the workspace filters store
 * and updates the global response filter state.
 */
export function ResponseFilterGroup() {
  const { issueResponseFilter, setIssueResponseFilter } = useWorkspaceFiltersStore();

  const handleFilterChange = (value: string) => {
    setIssueResponseFilter(value as IssueResponseFilter);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground font-medium">Response:</span>
      <Tabs value={issueResponseFilter} onValueChange={handleFilterChange} className="w-auto">
        <TabsList className="bg-muted rounded p-0.5 h-auto">
          <TabsTrigger value="all" className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-sm">
            All
          </TabsTrigger>
          <TabsTrigger
            value="needs_response"
            className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-sm"
          >
            Needs Response
          </TabsTrigger>
          <TabsTrigger
            value="replied"
            className="text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-sm"
          >
            Replied
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
