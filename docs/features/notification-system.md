# Notification System

## Workspace Work Inbox

The header bell now separates **Needs attention** from **Activity**. Needs attention
is the default and shows suggested replies and review requests across all active
workspaces the account owns or has accepted membership in. Activity retains existing
tracking, sync, and invitation notifications. The bell badge is the sum of unread work
and unread activity, so tracking and invitation alerts still surface in the header.
Opening the popover lands on Needs attention unless only Activity has unread items.
Users without workspaces keep their existing activity notifications but do not
perform GitHub work scans. On viewports narrower than 768px both sections render
inside the account menu instead of the header bell.

Work rows show repository owner logos, the repository, a direct GitHub conversation
link, the latest comment preview, and an explicit Mark read action. Reading does not
resolve a conversation or remove it from the work list. The UI uses a collision-aware
popover with internal scrolling instead of an operation-only dropdown.

### Account-Wide Identity

`workspace_work_inbox` has a unique key on `(user_id, repository_id, category,
subject_key)`. Workspace IDs never participate in notification identity. A repository
shared by multiple workspaces is scanned once per category, and produces one inbox
row per conversation/review request for that account, not one per workspace.

General comments use the parent GitHub node ID. Inline comments use the stable review
thread node ID, with the latest comment URL as the source version. Review requests
use the PR node ID: unrelated PR updates do not produce new notifications. A complete
scan that observes a request removed, followed by its reappearance, rearms the alert.
The database revision increases on new comment versions/reactivations so an old
Mark read request cannot consume a newer event. Tombstones remain after resolution
to prevent ordinary refreshes from recreating the same alert.

### Baselines, Ordering, And Partial Results

Each account/repository/category has a cursor. First-run items are visible but read,
so onboarding does not flood users with historical alerts. The first snapshot
initializes the baseline whether or not it was complete; a busy conversation with
truncated history must not silence a category forever. Future new items and comment
versions become unread. Repeated snapshots leave read state unchanged.

Completeness is tracked per repository. Truncated search pages, a conversation whose
visible comment window could not rule the viewer in or out, a failed comment batch,
and search hits returned under a different repository name (a rename or transfer)
all mark only the affected repositories incomplete. Only repositories with a complete
result resolve missing work. Snapshot writes run per repository in parallel; one
failing repository is reported by name and does not block the others.

Scans receive a server timestamp before contacting GitHub. Per-cursor transaction
locks and timestamp comparisons reject older responses that arrive after a newer
scan, including scans from other tabs/devices. Incomplete responses may update known
items but never resolve missing work. Inaccessible repositories and failed categories
do not write empty snapshots. Errors are shown, not presented as an empty inbox.

Scans are keyed by the account's repository set and reuse their result for five
minutes across scope refetches, window focus, and reconnects. GitHub search allows
30 requests per minute per account and the workspace Priority tab shares that budget.
Each scan requests a fresh server timestamp and repository list at scan time.

### Scope And Security

Migrations: `supabase/migrations/20260905210000_workspace_work_inbox.sql` and
`supabase/migrations/20260905230000_workspace_work_inbox_baseline.sql`. Run
`scripts/testing-tools/test-work-inbox-migration.sh` to exercise both against a
disposable local PostgreSQL. Repository names in item URLs are compared
case-insensitively, matching GitHub.

- `begin_workspace_work_scan` resolves `auth.uid()` through `app_users.auth_user_id`,
  then unions active owned workspaces and accepted memberships. It returns all distinct
  repository IDs/names, not the truncated repository previews used in the switcher.
- Snapshot and read RPCs accept no arbitrary recipient ID. They recheck current
  workspace repository eligibility and write only the caller's state.
- Both new tables have RLS. Authenticated users can SELECT only their own eligible
  inbox rows. Direct client INSERT/UPDATE/DELETE and cursor reads are revoked.
- SECURITY DEFINER functions have fixed search paths and explicit authenticated
  grants; PUBLIC and anon cannot execute them. Existing notification policies are
  not broadened.
- GitHub data is fetched with the existing Supabase session's provider token. The
  browser never sends that token to these RPCs or stores it in notification rows.
- Inbox/query data is ephemeral in the browser cache and scoped by auth account and
  login session. Supabase stores only the durable inbox/read state, not provider tokens.

These are browser-observed suggestions for the current user's own inbox, not verified
webhook events for delivering messages to other recipients. A future server worker
must independently resolve GitHub identity/access and recipient eligibility; it must
not trust client-submitted snapshots to send email or push notifications.

### Timing And Limits

The current phase checks GitHub every two minutes while the app is visible, and on
focus/reconnect. Other-device read state refreshes every 30 seconds. It is **not** an
offline notification service: closing the app stops work detection. There are no email
or browser-push permissions, subscriptions, or deliveries in this change.

The reply heuristics and GitHub search limits described in [My Work](./my-work-dashboard.md)
still apply. Review-request cycles that begin and end between scans cannot be detected.
The popup shows up to 30 pending items, unread first, with a separately counted unread
total. Existing stored work may be stale when GitHub is unavailable; the UI warns about
failed checks. This does not repair background repository capture.

### Validation And Deployment

Run `bash scripts/testing-tools/test-work-inbox-migration.sh` to test the migration in
a disposable PostgreSQL cluster over a Unix socket. It does not use `.env`, connect to
Supabase, or expose a TCP listener. The fixture is intentionally minimal; deployment
still requires testing against the full staging schema and checking security advisors.

The migration must be deployed before the new inbox can collect work. Without it,
the Work view shows a neutral "coming soon" empty state with a View activity action,
not a setup error or a claim that no work needs attention. Other loading failures
remain errors. The local
application currently uses the shared Supabase project; do not apply this migration
there implicitly as part of visual testing.

## Existing Operation Notifications

Real-time notification system for async operations like repository tracking, backfills, and sync operations.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Notification Types](#notification-types)
5. [Frontend Integration](#frontend-integration)
6. [Backend Integration](#backend-integration)
7. [Real-time Subscriptions](#real-time-subscriptions)
8. [Usage Examples](#usage-examples)
9. [Troubleshooting](#troubleshooting)

## Overview

The notification system provides real-time updates to users about async operations happening in the background. It replaces polling-based status checks with push-based notifications using Supabase Realtime.

### Key Features

- **Real-time Updates** - Push notifications via Supabase Realtime
- **Operation Tracking** - Track repository tracking, backfill, and sync operations
- **Rich Metadata** - Store operation details like duration, records synced, errors
- **User-friendly UI** - Dropdown notification center with unread badges
- **Automatic Cleanup** - Users can delete individual or all read notifications

### Performance Impact

- **100% reduction** in polling requests for tracked operations
- Real-time updates with <100ms latency
- Minimal database load with indexed queries

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend                        │
│                                                  │
│  ┌──────────────────┐  ┌─────────────────────┐ │
│  │ NotificationDropdown│  │ useNotifications  │ │
│  │    Component     │  │      Hook          │ │
│  └──────────────────┘  └─────────────────────┘ │
│           │                      │              │
│           └──────────┬───────────┘              │
│                      │                          │
│           ┌──────────▼──────────────┐           │
│           │  NotificationService    │           │
│           └──────────┬──────────────┘           │
└──────────────────────┼──────────────────────────┘
                       │
                       │ Supabase Client
                       │
┌──────────────────────▼──────────────────────────┐
│              Supabase Backend                    │
│                                                  │
│  ┌─────────────────┐      ┌──────────────────┐ │
│  │  notifications  │◄────►│  Realtime        │ │
│  │     Table       │      │  Subscriptions   │ │
│  └─────────────────┘      └──────────────────┘ │
│           ▲                                     │
│           │                                     │
│  ┌────────┴─────────┐                          │
│  │   RLS Policies   │                          │
│  └──────────────────┘                          │
└─────────────────────────────────────────────────┘
                       ▲
                       │ Service Role
                       │
┌──────────────────────┴──────────────────────────┐
│              Backend Services                    │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │  gh-datapipe (Inngest)                   │  │
│  │  - Backfill jobs write notifications      │  │
│  │  - Sync jobs write notifications          │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Database Schema

### Table: `notifications`

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('repository_tracking', 'backfill', 'sync', 'other')),
  repository TEXT,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'error')),
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes

```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_operation_id ON notifications(operation_id);
```

### RLS Policies

- Users can only view their own notifications
- Users can insert their own notifications
- Users can update their own notifications
- Users can delete their own notifications
- Service role can insert notifications (for backend operations)

### Realtime Configuration

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

## Notification Types

### Operation Types

| Type | Description | Created By |
|------|-------------|------------|
| `repository_tracking` | Repository tracking completed | Frontend |
| `backfill` | Manual backfill operation | Backend (gh-datapipe) |
| `sync` | Scheduled sync operation | Backend (gh-datapipe) |
| `other` | Custom operations | Either |

### Status Values

- `completed` - Operation succeeded
- `failed` - Operation failed with known error
- `error` - Operation failed with unknown error

### Metadata Structure

```typescript
interface NotificationMetadata {
  duration?: number;           // Operation duration in ms
  records_synced?: number;     // Number of records synced
  tables_processed?: string[]; // Tables affected
  contributors?: number;       // Contributors processed
  prs?: number;               // PRs processed
  events?: number;            // Events processed
  errors?: string[];          // Error messages
  [key: string]: unknown;     // Additional custom fields
}
```

## Frontend Integration

### useNotifications Hook

The primary interface for notifications in React components:

```typescript
import { useNotifications } from '@/hooks/use-notifications';

function MyComponent() {
  const {
    notifications,      // All notifications
    unreadCount,        // Unread notification count
    loading,           // Loading state
    markAsRead,        // Mark single notification as read
    markAllAsRead,     // Mark all as read
    deleteNotification, // Delete single notification
    deleteAllRead,     // Delete all read notifications
    refresh            // Manually refresh notifications
  } = useNotifications();

  return (
    <div>
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkAsRead={() => markAsRead(notification.id)}
          onDelete={() => deleteNotification(notification.id)}
        />
      ))}
    </div>
  );
}
```

### NotificationDropdown Component

Ready-to-use dropdown component:

```typescript
import { NotificationDropdown } from '@/components/notifications/notification-dropdown';

function Header() {
  return (
    <div className="header">
      {/* Other header items */}
      <NotificationDropdown />
    </div>
  );
}
```

### Creating Notifications (Frontend)

```typescript
import { NotificationService } from '@/lib/notifications/notification.service';

// After completing an operation
const success = await trackRepository(owner, repo);

if (success) {
  await NotificationService.createNotification({
    operation_id: `track-${Date.now()}`,
    operation_type: 'repository_tracking',
    repository: `${owner}/${repo}`,
    status: 'completed',
    title: 'Repository tracking complete',
    message: `Successfully tracked ${owner}/${repo}`,
    metadata: {
      duration: 1234,
      contributors: 42,
      prs: 156
    }
  });
}
```

## Backend Integration

### Creating Notifications (Backend)

Backend services use the Supabase service role to create notifications:

```typescript
// In gh-datapipe or other backend service
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Service role key
);

// After backfill job completes
await supabase.from('notifications').insert({
  user_id: userId,
  operation_id: jobId,
  operation_type: 'backfill',
  repository: 'owner/repo',
  status: 'completed',
  title: 'Backfill complete',
  message: 'Historical data has been synced',
  metadata: {
    duration: 45000,
    records_synced: 1500,
    tables_processed: ['contributors', 'pull_requests', 'events']
  }
});
```

### Inngest Integration

```typescript
// In Inngest function
export const backfillRepository = inngest.createFunction(
  { id: 'backfill-repository' },
  { event: 'repo/backfill.requested' },
  async ({ event, step }) => {
    const { userId, repository } = event.data;

    // Perform backfill
    const result = await step.run('backfill', async () => {
      // ... backfill logic
      return { recordsSynced: 1500, duration: 45000 };
    });

    // Create notification
    await step.run('notify', async () => {
      await supabase.from('notifications').insert({
        user_id: userId,
        operation_id: event.id,
        operation_type: 'backfill',
        repository,
        status: 'completed',
        title: 'Backfill complete',
        metadata: {
          duration: result.duration,
          records_synced: result.recordsSynced
        }
      });
    });
  }
);
```

## Real-time Subscriptions

### How It Works

1. **Client subscribes** to notifications table filtered by user_id
2. **Supabase Realtime** pushes changes to subscribed clients
3. **React hook** updates state automatically
4. **UI re-renders** with new notifications

### Subscription Lifecycle

```typescript
// In useNotifications hook
useEffect(() => {
  if (!user) return;

  const unsubscribe = NotificationService.subscribeToNotifications(
    user.id,
    // On INSERT
    (notification) => {
      setNotifications(prev => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount(prev => prev + 1);
      }
    },
    // On UPDATE
    (notification) => {
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? notification : n)
      );
    },
    // On DELETE
    (notificationId) => {
      setNotifications(prev =>
        prev.filter(n => n.id !== notificationId)
      );
    }
  );

  return () => unsubscribe();
}, [user]);
```

### Subscription Implementation

```typescript
// In NotificationService
subscribeToNotifications(
  userId: string,
  onInsert: (notification: Notification) => void,
  onUpdate: (notification: Notification) => void,
  onDelete: (notificationId: string) => void
) {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => onInsert(payload.new as Notification)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => onUpdate(payload.new as Notification)
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => onDelete(payload.old.id)
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}
```

## Usage Examples

### Example 1: Repository Tracking Notification

```typescript
// In use-repository-tracking.ts
const trackRepository = async (owner: string, repo: string) => {
  const startTime = Date.now();

  // Trigger tracking
  const result = await triggerTracking(owner, repo);

  if (result.success) {
    // Create success notification
    await NotificationService.createNotification({
      operation_id: result.eventId,
      operation_type: 'repository_tracking',
      repository: `${owner}/${repo}`,
      status: 'completed',
      title: 'Repository tracking complete',
      message: `${owner}/${repo} is now being tracked`,
      metadata: {
        duration: Date.now() - startTime,
        contributors: result.contributors,
        prs: result.pullRequests
      }
    });
  } else {
    // Create error notification
    await NotificationService.createNotification({
      operation_id: `track-${Date.now()}`,
      operation_type: 'repository_tracking',
      repository: `${owner}/${repo}`,
      status: 'error',
      title: 'Repository tracking failed',
      message: result.error,
      metadata: {
        duration: Date.now() - startTime,
        errors: [result.error]
      }
    });
  }
};
```

### Example 2: Backfill Progress Notification

```typescript
// Backend: Multi-step backfill with progress updates
const backfillWithProgress = async (userId: string, repo: string) => {
  const notificationId = await createInitialNotification(userId, repo);

  // Step 1: Fetch contributors
  const contributors = await fetchContributors(repo);
  await updateNotification(notificationId, {
    message: `Synced ${contributors.length} contributors`,
    metadata: { contributors: contributors.length }
  });

  // Step 2: Fetch PRs
  const prs = await fetchPRs(repo);
  await updateNotification(notificationId, {
    message: `Synced ${prs.length} pull requests`,
    metadata: { contributors: contributors.length, prs: prs.length }
  });

  // Step 3: Complete
  await updateNotification(notificationId, {
    status: 'completed',
    title: 'Backfill complete',
    message: 'All historical data has been synced',
    metadata: {
      contributors: contributors.length,
      prs: prs.length,
      duration: Date.now() - startTime
    }
  });
};
```

### Example 3: Bulk Operations

```typescript
// Notify about multiple repositories
const trackMultipleRepositories = async (repositories: string[]) => {
  const results = await Promise.allSettled(
    repositories.map(repo => trackRepository(repo))
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  await NotificationService.createNotification({
    operation_id: `bulk-track-${Date.now()}`,
    operation_type: 'other',
    status: failed > 0 ? 'completed' : 'completed',
    title: 'Bulk tracking complete',
    message: `Successfully tracked ${successful} of ${repositories.length} repositories`,
    metadata: {
      total: repositories.length,
      successful,
      failed,
      repositories: repositories
    }
  });
};
```

## Troubleshooting

### Notifications Not Appearing

1. **Check user authentication**
   ```typescript
   const { user } = useNotifications();
   console.log('Current user:', user); // Should not be null
   ```

2. **Verify Realtime subscription**
   ```typescript
   // Check browser console for Realtime connection
   // Should see: "Realtime channel connected"
   ```

3. **Check RLS policies**
   ```sql
   -- Verify user can read their notifications
   SELECT * FROM notifications WHERE user_id = auth.uid();
   ```

4. **Verify Realtime is enabled**
   ```sql
   -- Check publication includes notifications table
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```

### Notifications Not Real-time

1. **Check Realtime connection status**
   ```typescript
   const status = supabase.channel('notifications').state;
   console.log('Channel status:', status); // Should be 'joined'
   ```

2. **Verify subscription filters**
   ```typescript
   // Ensure user_id filter is correct
   filter: `user_id=eq.${userId}` // Must match exactly
   ```

3. **Check browser console for errors**
   - Look for WebSocket connection errors
   - Check for authentication errors

### Performance Issues

1. **Too many notifications**
   - Implement pagination in `getNotifications()`
   - Add automatic cleanup for old notifications
   - Limit real-time updates to recent notifications

2. **Slow queries**
   - Verify indexes exist on `user_id`, `created_at`, `read`
   - Use `EXPLAIN ANALYZE` to check query performance
   - Consider archiving old notifications

3. **Memory leaks**
   - Ensure subscriptions are properly unsubscribed
   - Check cleanup in `useEffect` return functions
   - Monitor component unmounting

### Common Errors

**Error: "Row Level Security policy violation"**
- User is not authenticated
- RLS policy doesn't allow operation
- Check `auth.uid()` returns correct user ID

**Error: "Subscription failed"**
- Realtime not enabled on table
- Publication doesn't include notifications table
- WebSocket connection blocked by firewall/proxy

**Error: "Infinite re-renders"**
- Check dependency arrays in useEffect
- Ensure callbacks are memoized with useCallback
- Avoid including state in subscription dependencies

## Related Documentation

- [Database Schema](../database/schema.md)
- [Supabase Realtime](../supabase/realtime.md)
- [GitHub App Integration](../github-app/README.md)
- [Inngest Background Jobs](../infrastructure/inngest.md)

## Migration Guide

If upgrading from polling-based notifications:

1. Apply migration: `supabase/migrations/20251006000000_notifications_table.sql`
2. Replace polling hooks with `useNotifications`
3. Update backend to create notifications
4. Remove old polling logic
5. Test real-time updates
6. Deploy and monitor

## Future Enhancements

- [ ] Email notifications for important operations
- [ ] In-app notification preferences
- [ ] Notification grouping by repository
- [ ] Notification sounds/vibrations
- [ ] Desktop push notifications
- [ ] Notification history/archive
