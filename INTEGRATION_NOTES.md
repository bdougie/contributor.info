# Integration Notes for useWorkspaceIssues Hook

## Current Status

✅ **Created:**
- `src/hooks/useWorkspaceIssues.ts` - Hook for fetching issues with linked PRs
- `supabase/migrations/20250110_add_linked_prs_to_issues.sql` - Database migration

❌ **Not Yet Integrated:**
- The `WorkspaceIssues` component in `src/pages/workspace-page.tsx` still uses the old manual `fetchIssues()` approach

## Required Integration Steps

### 1. Import the hook in workspace-page.tsx

Add this import at the top with other hooks:

```typescript
import { useWorkspaceIssues } from '@/hooks/useWorkspaceIssues';
```

### 2. Replace the WorkspaceIssues component implementation

Replace the current implementation (lines ~647-823) with:

```typescript
function WorkspaceIssues({
  repositories,
  selectedRepositories,
  timeRange,
  workspaceId,  // Add this prop
  workspace,    // Add this prop
  onGitHubAppModalOpen,
  currentUser,
  currentMember,
  onIssueRespond,
}: {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: TimeRange;
  workspaceId: string;  // Add this
  workspace?: Workspace; // Add this
  onGitHubAppModalOpen: (repo: Repository) => void;
  currentUser: User | null;
  currentMember: WorkspaceMemberWithUser | null;
  onIssueRespond?: (issue: Issue) => void;
}) {
  const navigate = useNavigate();

  // Use the new hook for automatic issue syncing and caching
  const { issues, loading, error, lastSynced, isStale, refresh } = useWorkspaceIssues({
    repositories,
    selectedRepositories,
    workspaceId,
    refreshInterval: 60, // Hourly refresh interval
    maxStaleMinutes: 60, // Consider data stale after 60 minutes
    autoSyncOnMount: true, // Auto-sync enabled with hourly refresh
  });

  // Log sync status for debugging
  useEffect(() => {
    if (lastSynced) {
      const minutesAgo = ((Date.now() - lastSynced.getTime()) / (1000 * 60)).toFixed(1);
      console.log(
        `Issue data last synced ${minutesAgo} minutes ago${isStale ? ' (stale)' : ' (fresh)'}`
      );
    }
  }, [lastSynced, isStale]);

  // Show error toast if sync fails
  useEffect(() => {
    if (error) {
      toast.error('Failed to fetch issues', {
        description: error,
        action: {
          label: 'Retry',
          onClick: () => refresh(),
        },
      });
    }
  }, [error, refresh]);

  // ... rest of the component (handlers, filtering, etc.) ...
  
  // Add auto-sync indicator like in PRs tab:
  return (
    <div className="space-y-6">
      {/* Auto-sync indicator at top of tab */}
      <div className="flex items-center justify-between px-1">
        <WorkspaceAutoSync
          workspaceId={workspaceId}
          workspaceSlug={workspace?.slug || 'workspace'}
          repositoryIds={repositories.map((r) => r.id).filter(Boolean)}
          onSyncComplete={refresh}
          syncIntervalMinutes={60}
          className="text-sm text-muted-foreground"
        />
        <div className="flex items-center gap-2">
          {ctaRepo && (
            <Button
              onClick={() => onGitHubAppModalOpen(ctaRepo)}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Similarity
            </Button>
          )}
        </div>
      </div>

      {/* ... rest of UI ... */}
    </div>
  );
}
```

### 3. Update the WorkspaceIssues component call

In the `TabsContent` for issues (around line 3920), update the props:

```typescript
<WorkspaceIssues
  repositories={repositories}
  selectedRepositories={selectedRepositories}
  timeRange={timeRange}
  workspaceId={workspace.id}  // Add this
  workspace={workspace}        // Add this
  onGitHubAppModalOpen={handleGitHubAppModalOpen}
  currentUser={currentUser}
  currentMember={currentMember}
  onIssueRespond={handleIssueRespond}
/>
```

## Why This Wasn't Done Automatically

The `workspace-page.tsx` file is 4000+ lines long, making it too large for the AI tool to edit directly. The file needs to be manually updated by a developer.

## Testing Checklist

After integration:

- [ ] Run the database migration
- [ ] Test issue loading with the new hook
- [ ] Verify linked PRs appear in the table
- [ ] Check auto-sync indicator appears
- [ ] Test manual refresh button
- [ ] Verify GitHub token handling
- [ ] Check rate limit behavior
- [ ] Test with repositories that have no issues
- [ ] Test with repositories that have issues with linked PRs

## Reference

See PR #1072 for the infrastructure implementation.
