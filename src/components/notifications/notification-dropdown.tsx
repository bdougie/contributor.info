// Notification dropdown component for header
// Related to issue #959: Add notification system for async operations

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { NotificationsList } from './notifications-list';
import { useNotifications } from '@/hooks/use-notifications';
import { cn } from '@/lib/utils';

interface NotificationDropdownProps {
  className?: string;
}

export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
  } = useNotifications({ limit: 20 });

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleClearAll = async () => {
    await deleteAllRead();
  };

  const isEmpty = notifications.length === 0 && !loading;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('relative', className)}
          title={isEmpty ? 'No notifications' : 'View notifications'}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Icon name="bell" size={18} className={cn(isEmpty && 'opacity-50')} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">
            {isEmpty ? 'No notifications' : `${unreadCount} notifications`}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[90vw] md:w-[400px] p-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 pb-2 gap-2">
          <DropdownMenuLabel className="p-0 text-base font-semibold">
            Notifications
          </DropdownMenuLabel>
          {notifications.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleMarkAllAsRead}
                >
                  Mark all read
                </Button>
              )}
              {notifications.some((n) => n.read) && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClearAll}>
                  Clear read
                </Button>
              )}
            </div>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />
        <div className="max-h-[400px] overflow-y-auto">
          <NotificationsList
            notifications={notifications}
            loading={loading}
            onMarkAsRead={markAsRead}
            onDelete={deleteNotification}
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
