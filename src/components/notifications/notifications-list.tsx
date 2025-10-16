// Notifications list component with empty state
// Related to issue #959: Add notification system for async operations

import { NotificationItem } from './notification-item';
import { EmptyState } from '@/components/ui/empty-state';
import { Loader2, Bell } from '@/components/ui/icon';
import type { Notification } from '@/lib/notifications';

interface NotificationsListProps {
  notifications: Notification[];
  loading?: boolean;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function NotificationsList({
  notifications,
  loading = false,
  onMarkAsRead,
  onDelete,
}: NotificationsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={<Bell size={32} />}
        title="No notifications"
        description="You're all caught up! Notifications will appear here when operations complete."
        className="m-4"
      />
    );
  }

  return (
    <div className="divide-y">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
