# Atomic Invitation Acceptance Migration

## Overview
Migration `20251016000000_atomic_accept_invitation.sql` fixes a critical race condition in workspace invitation acceptance.

## Problem
The previous implementation (`WorkspaceService.acceptInvitation`) performed multiple separate database operations:
1. Fetch invitation
2. Check if member exists
3. Insert member
4. Update invitation status

Under concurrent requests, multiple users could bypass validation checks and create duplicate members.

## Solution
Created `accept_workspace_invitation` RPC function that:
- Uses `FOR UPDATE` row-level locking on invitation and member rows
- Performs all operations atomically in a single transaction
- Returns structured success/error codes for proper HTTP status mapping

## Usage
```typescript
const { data, error } = await supabase.rpc('accept_workspace_invitation', {
  p_invitation_token: token,   // UUID
  p_user_id: userId             // UUID
});

// data is an array with one row:
const result = data?.[0];
if (result.success) {
  // Invitation accepted successfully
  // result.workspace_id and result.member_role available
} else {
  // Handle error: result.error_code and result.error_message
}
```

## Error Codes
- `NOT_FOUND` - Invalid invitation token
- `EXPIRED` - Invitation has expired
- `ALREADY_PROCESSED` - Invitation already accepted/declined
- `ALREADY_MEMBER` - User is already a workspace member

## Testing
The e2e tests in `e2e/workspace-invitation-lifecycle.spec.ts` validate the entire invitation flow including this atomic acceptance.

## Security
- Function uses `SECURITY DEFINER` with `authenticated` role grants
- Input validation performed within function
- Transaction isolation prevents race conditions

## Performance
- Reduces database round-trips from 4+ queries to 1 RPC call
- Row-level locking prevents unnecessary retry logic
- Atomic operations ensure data consistency
