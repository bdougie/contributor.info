// Notification service for managing async operation notifications
// Related to issue #959: Add notification system for async operations

import { supabase } from '../supabase';
import type { Notification, CreateNotificationParams, NotificationFilters } from './types';

export class NotificationService {
  /**
   * Create a new notification
   */
  static async createNotification(
    params: CreateNotificationParams,
    userId?: string
  ): Promise<Notification | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;

    if (!targetUserId) {
      console.error('No user ID provided for notification creation');
      return null;
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: targetUserId,
        operation_id: params.operation_id,
        operation_type: params.operation_type,
        repository: params.repository,
        status: params.status,
        title: params.title,
        message: params.message,
        metadata: params.metadata || {},
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }

    return data;
  }

  /**
   * Get notifications for the current user
   */
  static async getNotifications(filters: NotificationFilters = {}): Promise<Notification[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filters.unread_only) {
      query = query.eq('read', false);
    }

    if (filters.operation_type) {
      query = query.eq('operation_type', filters.operation_type);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(): Promise<number> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return 0;
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return true;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }

    return true;
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string): Promise<boolean> {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }

    return true;
  }

  /**
   * Delete all read notifications
   */
  static async deleteAllRead(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id)
      .eq('read', true);

    if (error) {
      console.error('Error deleting read notifications:', error);
      return false;
    }

    return true;
  }

  /**
   * Subscribe to real-time notification updates
   */
  static subscribeToNotifications(
    userId: string,
    onNotification: (notification: Notification) => void,
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
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onNotification(payload.new as Notification)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onUpdate(payload.new as Notification)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onDelete(payload.old.id as string)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
