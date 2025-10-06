// React hook for notifications with Realtime subscriptions
// Related to issue #959: Add notification system for async operations

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { NotificationService } from '../lib/notifications';
import type { Notification, NotificationFilters } from '../lib/notifications';
import type { User } from '@supabase/supabase-js';

export function useNotifications(filters: NotificationFilters = {}) {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasInitialLoad, setHasInitialLoad] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    // Only show loading on initial fetch
    if (!hasInitialLoad) {
      setLoading(true);
    }

    const data = await NotificationService.getNotifications(filters);
    setNotifications(data);
    setLoading(false);
    setHasInitialLoad(true);
  }, [user, filters, hasInitialLoad]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    const count = await NotificationService.getUnreadCount();
    setUnreadCount(count);
  }, [user]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const success = await NotificationService.markAsRead(notificationId);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    return success;
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    const success = await NotificationService.markAllAsRead();
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
    return success;
  }, []);

  // Delete notification
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      const success = await NotificationService.deleteNotification(notificationId);
      if (success) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        // Update unread count if deleted notification was unread
        const notification = notifications.find((n) => n.id === notificationId);
        if (notification && !notification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
      return success;
    },
    [notifications]
  );

  // Delete all read notifications
  const deleteAllRead = useCallback(async () => {
    const success = await NotificationService.deleteAllRead();
    if (success) {
      setNotifications((prev) => prev.filter((n) => !n.read));
    }
    return success;
  }, []);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    fetchNotifications();
    fetchUnreadCount();

    const unsubscribe = NotificationService.subscribeToNotifications(
      user.id,
      // On new notification
      (notification) => {
        setNotifications((prev) => [notification, ...prev]);
        if (!notification.read) {
          setUnreadCount((prev) => prev + 1);
        }
      },
      // On notification update
      (notification) => {
        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? notification : n)));
        fetchUnreadCount();
      },
      // On notification delete
      (notificationId) => {
        const notification = notifications.find((n) => n.id === notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        if (notification && !notification.read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, fetchNotifications, fetchUnreadCount, notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    refresh: fetchNotifications,
  };
}
