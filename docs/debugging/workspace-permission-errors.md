# Debugging Workspace Permission Errors

## Issue: "Insufficient permissions to add repositories"

### Overview
This error occurs when a user tries to add a repository to a workspace but lacks the required workspace membership role.

### Root Cause
The `addRepositoryToWorkspace` function in `src/services/workspace.service.ts` checks if the user has 'owner' or 'maintainer' role in the workspace. If not, it returns a 403 error.

### Recent Changes (2025-01-03)
Enhanced debugging and error messages to help diagnose permission issues:

1. **Added debug logging to `checkPermission()`** (workspace.service.ts:515-547)
   - Logs workspace ID, user ID, and required roles
   - Logs database query errors
   - Logs when user is not a member
   - Logs final permission check result with user's role

2. **Enhanced error messages in `addRepositoryToWorkspace()`** (workspace.service.ts:570-587)
   - Shows user's current role (or "not a member")
   - Shows required roles (owner or maintainer)
   - Logs detailed permission denial information

3. **Improved frontend error handling** (AddToWorkspaceModal.tsx:160-178)
   - Shows longer toast notification for permission errors (6 seconds)
   - Includes helpful description suggesting to contact workspace owner
   - Logs detailed error information to console

### How to Debug

#### 1. Check Browser Console
When the error occurs, check the browser console for logs:

```
[WorkspaceService] Checking permissions: { workspaceId: '...', userId: '...', requiredRoles: ['owner', 'maintainer'] }
[WorkspaceService] User is not a member of workspace: { workspaceId: '...', userId: '...' }
[WorkspaceService] Permission denied for addRepositoryToWorkspace: { ... }
[AddToWorkspaceModal] Failed to add repository: { ... }
```

#### 2. Common Scenarios

**Scenario 1: User is not a member of workspace**
- Error: "Insufficient permissions to add repositories. You are not a member of this workspace."
- Solution: Invite the user to the workspace first

**Scenario 2: User has 'contributor' role**
- Error: "Insufficient permissions to add repositories. Your role: contributor. Required: owner, admin, or maintainer."
- Solution: Upgrade user's role to 'admin', 'maintainer', or 'owner'

**Scenario 3: Database query error**
- Check logs for `[WorkspaceService] Database query error:`
- Could be authentication issue, network issue, or database schema mismatch

#### 3. Verify Workspace Membership
Check the `workspace_members` table in Supabase:

```sql
SELECT * FROM workspace_members
WHERE workspace_id = 'workspace-id-here'
AND user_id = 'user-id-here';
```

Expected result should include a `role` field with value: 'owner', 'maintainer', or 'contributor'

#### 4. Check User Authentication
Verify the user is properly authenticated:
- Check if `user.id` is present in the request
- Verify the Supabase session is valid
- Check if the auth token hasn't expired

### Required Permissions

| Action | Required Role(s) |
|--------|-----------------|
| Add repository to workspace | owner, admin, maintainer |
| Remove repository from workspace | owner, admin, maintainer |
| Update repository settings | owner, admin, maintainer |
| Invite members | owner, admin, maintainer |
| Remove members | owner |
| Delete workspace | owner |

**Note:** The codebase uses 'admin' as the primary secondary role, though 'maintainer' is also supported for compatibility.

### User Experience

When properly configured, users will see:
1. **Success**: "Added owner/repo to workspace successfully!" (navigates to workspace)
2. **Permission Error**: Detailed error with current role + suggestion to contact workspace owner
3. **Not a Member**: Clear message that they're not a member of the workspace

### Related Files
- `src/services/workspace.service.ts` - Permission checking logic
- `src/components/features/workspace/AddToWorkspaceModal.tsx` - UI component
- `supabase/migrations/*` - Database schema for workspace_members table

### Testing Checklist

To verify the fix works correctly:

- [ ] User with 'owner' role can add repositories
- [ ] User with 'maintainer' role can add repositories
- [ ] User with 'contributor' role sees clear error message with their role
- [ ] User not in workspace sees clear "not a member" message
- [ ] Error messages include actionable suggestions
- [ ] Console logs provide sufficient debugging information
- [ ] Invalid workspace ID fails gracefully

### Production Debugging

When debugging in production:
1. Open browser DevTools console
2. Attempt to add repository to workspace
3. Look for `[WorkspaceService]` and `[AddToWorkspaceModal]` logs
4. Check the user's actual role in the workspace via Supabase Dashboard
5. Verify the workspace exists and the workspace ID is correct
