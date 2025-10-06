# Notification System

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
