// Individual notification item component
// Related to issue #959: Add notification system for async operations

import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertCircle, Clock, Trash2 } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/lib/notifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const getStatusIcon = () => {
    switch (notification.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-500" />;
    }
  };

  const getOperationLabel = () => {
    switch (notification.operation_type) {
      case 'repository_tracking':
        return 'Repository Tracking';
      case 'backfill':
        return 'Data Backfill';
      case 'sync':
        return 'Data Sync';
      default:
        return 'Operation';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const handleClick = () => {
    if (!notification.read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative flex gap-3 p-4 transition-colors hover:bg-muted/50',
        !notification.read && 'bg-muted/30',
        'cursor-pointer'
      )}
    >
      {/* Status icon */}
      <div className="flex-shrink-0 pt-0.5">{getStatusIcon()}</div>

      {/* Content */}
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className={cn('text-sm font-medium', !notification.read && 'font-semibold')}>
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground">{getOperationLabel()}</p>
          </div>
          {!notification.read && (
            <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" aria-label="Unread" />
          )}
        </div>

        {notification.message && (
          <p className="text-sm text-muted-foreground">{notification.message}</p>
        )}

        {notification.repository && (
          <p className="text-xs text-muted-foreground">
            Repository: <span className="font-mono">{notification.repository}</span>
          </p>
        )}

        {/* Metadata */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {notification.metadata.duration && (
            <span>Duration: {formatDuration(notification.metadata.duration)}</span>
          )}
          {notification.metadata.records_synced !== undefined && (
            <span>Records: {notification.metadata.records_synced.toLocaleString()}</span>
          )}
          {notification.metadata.contributors !== undefined && (
            <span>Contributors: {notification.metadata.contributors}</span>
          )}
        </div>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground">
          {new Date(notification.created_at).toLocaleString()}
        </p>
      </div>

      {/* Delete button */}
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete notification</span>
        </Button>
      )}
    </div>
  );
}
