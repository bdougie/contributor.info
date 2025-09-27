# Contributor Visibility Tiers

## Overview

The Contributor of the Month display implements a tiered visibility system to encourage workspace upgrades while rewarding paying users with full access to contributor rankings.

## Feature Behavior

### For Free Users
- **Top 3 contributors** are displayed
- **#1 contributor is blurred** with an overlay
- **"Upgrade to view" button** (orange) appears over the blurred #1 contributor
- Clicking the button opens the workspace creation modal
- Total contributor count is shown (e.g., "23 active contributors")

### For Paid Workspace Members
Users who own or are members of paid workspaces (pro, team, or enterprise tier) get:
- **Full visibility of all top 3 contributors** including #1
- **No blur effect** on any contributor cards
- **No upgrade CTA button** over the #1 contributor
- Same total contributor count display

## Implementation Details

### Hook: `useHasPaidWorkspace`

Location: `/src/hooks/use-has-paid-workspace.ts`

This hook determines if the current user has access to paid features:

```typescript
export function useHasPaidWorkspace(): {
  hasPaidWorkspace: boolean;
  loading: boolean;
}
```

**Logic:**
1. Checks if user is authenticated
2. Queries if user owns any workspace with tier in ['pro', 'team', 'enterprise']
3. If not owner, checks if user is member of any paid workspace
4. Returns `true` if user has any paid workspace access
5. Listens for auth state changes and refetches accordingly

### Component Integration

The `ContributorOfTheMonth` component uses the hook to conditionally apply blur:

```typescript
const { hasPaidWorkspace } = useHasPaidWorkspace();

// Only blur #1 if:
// 1. showBlurredFirst prop is true (from wrapper)
// 2. User does NOT have paid workspace
const isFirstPlace = index === 0 && showBlurredFirst && !hasPaidWorkspace;
```

## Database Schema

The tier information is stored in the `workspaces` table:

- `tier` column: text field with values 'free', 'pro', 'team', or 'enterprise'
- `is_active` column: boolean to filter active workspaces
- `owner_id` column: UUID linking to the workspace owner
- `workspace_members` table: Links users to workspaces they're members of

## Testing

Tests are located in `/src/hooks/__tests__/use-has-paid-workspace.test.ts`

Test coverage includes:
- Unauthenticated users (returns false)
- Users with free workspaces only (returns false)
- Users owning pro/team/enterprise workspaces (returns true)
- Users as members of paid workspaces (returns true)
- Error handling
- Auth state change refetching

## User Experience Flow

1. **New visitor**: Sees blurred #1 with "Upgrade to view" CTA
2. **Clicks upgrade**: Opens workspace creation modal
3. **Creates paid workspace**: Blur immediately removed, full access granted
4. **Returns later**: No blur if still has paid workspace access

## Benefits

- **Conversion Driver**: Visual incentive to upgrade to paid tiers
- **Value Demonstration**: Shows what users get with paid access
- **Fair Access**: Rewards paying customers immediately
- **Seamless UX**: No page reload needed after upgrade

## Related Files

- `/src/components/features/contributor/contributor-of-the-month.tsx` - Main display component
- `/src/components/features/contributor/contributor-of-month-wrapper.tsx` - Wrapper with data fetching
- `/src/hooks/use-has-paid-workspace.ts` - Tier checking hook
- `/src/hooks/__tests__/use-has-paid-workspace.test.ts` - Test suite