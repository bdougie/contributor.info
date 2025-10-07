# Workspace Invitation Notifications

## Overview

Workspace invitation notifications provide real-time feedback to workspace owners and maintainers when they invite members and when those invitations are accepted. This feature creates a transparent, user-friendly invitation flow with automatic status updates.

**Related Issue**: #975
**PR**: #1000

## User Experience

When a user invites someone to their workspace:

1. **Invitation Sent** - Inviter receives a notification confirming the invitation was sent
2. **Invitation Accepted** - Inviter receives a notification when the invitee joins the workspace

Both notifications appear in the user's notification center with relevant workspace and user context.

## Technical Implementation

### Notification Flow

```
User sends invite → Notification created (status: pending, invite_status: sent)
                     ↓
Invitee accepts   → Notification created (status: completed, invite_status: accepted)
```

### Data Structure

#### Notification Types

**Operation Type**: `invite`
**Status Values**: `pending` (sent) | `completed` (accepted)

#### Metadata Fields

```typescript
{
  workspace_id: string;        // UUID of the workspace
  workspace_name: string;      // Human-readable workspace name
  invitee_email: string;       // Email address of invitee
  invitee_username?: string;   // Display name (only on acceptance)
  invited_by_username?: string; // Display name of inviter
  role: string;                // Workspace role (contributor/maintainer)
  invite_status: 'sent' | 'accepted' | 'declined' | 'expired';
}
```

### Code Locations

#### Type Definitions
**File**: `src/lib/notifications/types.ts:8`
- Added `'invite'` to `NotificationOperationType`
- Added `'pending'` to `NotificationStatus`
- Added invite metadata fields to `NotificationMetadata`

#### Invitation Creation
**File**: `src/services/workspace.service.ts:1136-1168`

When a workspace invitation is created:

```typescript
await NotificationService.createNotification(
  {
    operation_id: invitation.id,
    operation_type: 'invite',
    status: 'pending',
    title: `Invitation sent to ${email}`,
    message: `Your invitation to join ${workspaceName} has been sent`,
    metadata: {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      invitee_email: email,
      role,
      invite_status: 'sent',
    },
  },
  inviterId
);
```

#### Invitation Acceptance
**File**: `supabase/functions/workspace-invitation-accept/index.ts:252-277`

When an invitation is accepted:

```typescript
await supabase.from('notifications').insert({
  user_id: invitation.invited_by,
  operation_id: invitation.id,
  operation_type: 'invite',
  status: 'completed',
  title: `${username} accepted your invitation`,
  message: `${username} has joined ${workspaceName}`,
  metadata: {
    workspace_id: invitation.workspace_id,
    workspace_name: workspaceName,
    invitee_email: invitation.email,
    invitee_username: username,
    role: invitation.role,
    invite_status: 'accepted',
  },
});
```

## Usage Examples

### Sending an Invitation

```typescript
// In workspace service
const result = await WorkspaceService.inviteMember(
  workspaceId,
  currentUserId,
  'user@example.com',
  'contributor'
);

// Notification is automatically created for the inviter
// No additional code needed
```

### Accepting an Invitation

```typescript
// In edge function
const result = await WorkspaceService.acceptInvitation(token, userId);

// Notification is automatically created for the inviter
// No additional code needed
```

### Querying Invite Notifications

```typescript
import { NotificationService } from '@/lib/notifications/notification.service';

// Get all invite notifications
const { items } = await NotificationService.listNotifications(userId, {
  operation_type: 'invite',
  limit: 10,
});

// Filter by status
const pending = items.filter(n => n.status === 'pending'); // Sent
const completed = items.filter(n => n.status === 'completed'); // Accepted
```

## Notification Display

### Pending (Invitation Sent)

```
Title: Invitation sent to user@example.com
Message: Your invitation to join Engineering Team has been sent
Status: pending
Icon: Mail/Envelope icon
```

### Completed (Invitation Accepted)

```
Title: john-doe accepted your invitation
Message: john-doe has joined Engineering Team
Status: completed
Icon: Check/Success icon
```

## Error Handling

Notification creation is **non-blocking**. If notification creation fails:

1. Invitation is still created successfully
2. Error is logged to console
3. User flow continues uninterrupted

```typescript
try {
  await NotificationService.createNotification(...);
} catch (err) {
  console.error('Failed to create notification:', err);
  // Don't fail the invitation
}
```

## Testing

### Unit Tests

**File**: `src/lib/notifications/__tests__/types.test.ts`

Tests validate:
- Type definitions include `'invite'` and `'pending'`
- Metadata structure supports all invite fields
- Notification objects are correctly typed

```bash
npm test -- src/lib/notifications/__tests__/types.test.ts
```

### E2E Tests

Invite notifications should be tested in the workspace invitation E2E flow:

```typescript
// Suggested test case
test('should create notifications for invitation flow', async ({ page }) => {
  // 1. Login as workspace owner
  // 2. Send invitation
  // 3. Verify notification created (pending)
  // 4. Accept invitation as invitee
  // 5. Verify notification updated (completed)
});
```

## Database Schema

### Notifications Table

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  operation_id UUID NOT NULL,
  operation_type TEXT NOT NULL, -- 'invite'
  status TEXT NOT NULL,         -- 'pending' | 'completed'
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Future Enhancements

### Potential Improvements

1. **Declined Invitations** - Notify inviter when invitation is declined
2. **Expired Invitations** - Notify inviter when invitation expires
3. **Invitation Reminders** - Remind inviter about pending invitations after X days
4. **Batch Notifications** - Group multiple invitation acceptances
5. **Email Integration** - Send email notifications for important events

### Notification Preferences

Allow users to configure which invitation notifications they receive:

```typescript
interface NotificationPreferences {
  invite_sent: boolean;        // Default: true
  invite_accepted: boolean;    // Default: true
  invite_declined: boolean;    // Default: true
  invite_expired: boolean;     // Default: false
}
```

## Related Documentation

- [Notification System Architecture](../architecture/notifications.md)
- [Workspace Invitation Flow](./workspace-invitations.md)
- [Notification Service API](../api/notification-service.md)

## Changelog

### 2025-10-07
- Initial implementation of invite notifications
- Added `'invite'` operation type
- Added `'pending'` status for sent invitations
- Implemented notification creation on invite send and accept
