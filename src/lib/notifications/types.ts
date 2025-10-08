// Notification types aligned with database schema
// Related to issue #959: Add notification system for async operations

export type NotificationOperationType =
  | 'repository_tracking'
  | 'backfill'
  | 'sync'
  | 'invite'
  | 'other';
export type NotificationStatus = 'completed' | 'failed' | 'error' | 'pending';

export interface NotificationMetadata {
  // Repository tracking/sync fields
  duration?: number;
  records_synced?: number;
  tables_processed?: string[];
  contributors?: number;
  prs?: number;
  events?: number;
  errors?: string[];

  // Workspace invite fields
  workspace_id?: string;
  workspace_name?: string;
  invitee_email?: string;
  invitee_username?: string;
  invited_by_username?: string;
  role?: string;
  invite_status?: 'sent' | 'accepted' | 'declined' | 'expired';

  [key: string]: unknown;
}

export interface Notification {
  id: string;
  user_id: string;
  operation_id: string;
  operation_type: NotificationOperationType;
  repository?: string;
  status: NotificationStatus;
  title: string;
  message?: string;
  metadata: NotificationMetadata;
  read: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationParams {
  operation_id: string;
  operation_type: NotificationOperationType;
  repository?: string;
  status: NotificationStatus;
  title: string;
  message?: string;
  metadata?: NotificationMetadata;
}

export interface NotificationFilters {
  unread_only?: boolean;
  operation_type?: NotificationOperationType;
  limit?: number;
  offset?: number;
}
