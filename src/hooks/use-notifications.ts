import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from './use-current-user';
import { NotificationService } from '@/lib/notifications';
import type { NotificationFilters } from '@/lib/notifications';
import { EPHEMERAL_QUERY_META } from '@/lib/query-client';

export function useNotifications(filters: NotificationFilters = {}) {
  const { user } = useCurrentUser();
  const userId = user?.id;
  const client = useQueryClient();
  const identity = ['notifications', user?.id, user?.last_sign_in_at];
  const result = useQuery({
    queryKey: [...identity, filters],
    queryFn: async () => {
      const [notifications, unreadCount] = await Promise.all([
        NotificationService.getNotifications(filters),
        NotificationService.getUnreadCount(),
      ]);
      return { notifications, unreadCount };
    },
    enabled: !!user,
    meta: EPHEMERAL_QUERY_META,
    gcTime: 0,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!userId) return;
    // Re-read the authoritative list/count instead of incrementing for replayed events.
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['notifications', userId] });
    };
    return NotificationService.subscribeToNotifications(userId, refresh, refresh, refresh);
  }, [client, userId]);

  const mutate = async (action: () => Promise<boolean>) => {
    const success = await action();
    if (success) await client.invalidateQueries({ queryKey: identity });
    return success;
  };

  return {
    notifications: user ? result.data?.notifications || [] : [],
    unreadCount: user ? result.data?.unreadCount || 0 : 0,
    loading: !!user && result.isLoading,
    error: result.error?.message,
    markAsRead: (id: string) => mutate(() => NotificationService.markAsRead(id)),
    markAllAsRead: () => mutate(() => NotificationService.markAllAsRead()),
    deleteNotification: (id: string) => mutate(() => NotificationService.deleteNotification(id)),
    deleteAllRead: () => mutate(() => NotificationService.deleteAllRead()),
    refresh: () => result.refetch(),
  };
}
