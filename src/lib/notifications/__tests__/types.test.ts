/**
 * Bulletproof tests for notification types
 * Per BULLETPROOF_TESTING_GUIDELINES.md - no async, pure validation only
 */
import { describe, it, expect } from 'vitest';
import type {
  NotificationOperationType,
  NotificationStatus,
  NotificationMetadata,
  Notification,
  CreateNotificationParams,
} from '../types';

describe('Notification Types', () => {
  describe('NotificationOperationType', () => {
    it('should include invite operation type', () => {
      const operationType: NotificationOperationType = 'invite';
      expect(operationType).toBe('invite');
    });

    it('should include all expected operation types', () => {
      const types: NotificationOperationType[] = [
        'repository_tracking',
        'backfill',
        'sync',
        'invite',
        'other',
      ];
      expect(types).toHaveLength(5);
    });
  });

  describe('NotificationStatus', () => {
    it('should include pending status', () => {
      const status: NotificationStatus = 'pending';
      expect(status).toBe('pending');
    });

    it('should include all expected statuses', () => {
      const statuses: NotificationStatus[] = ['completed', 'failed', 'error', 'pending'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('NotificationMetadata', () => {
    it('should support workspace invite metadata fields', () => {
      const metadata: NotificationMetadata = {
        workspace_id: 'workspace-123',
        workspace_name: 'Test Workspace',
        invitee_email: 'test@example.com',
        invitee_username: 'testuser',
        invited_by_username: 'inviter',
        role: 'contributor',
        invite_status: 'sent',
      };

      expect(metadata.workspace_id).toBe('workspace-123');
      expect(metadata.invitee_email).toBe('test@example.com');
      expect(metadata.invite_status).toBe('sent');
    });

    it('should support all invite status values', () => {
      const statuses: Array<NotificationMetadata['invite_status']> = [
        'sent',
        'accepted',
        'declined',
        'expired',
      ];
      expect(statuses).toHaveLength(4);
    });

    it('should allow repository tracking metadata alongside invite metadata', () => {
      const metadata: NotificationMetadata = {
        // Repository fields
        duration: 1000,
        records_synced: 50,
        // Invite fields
        workspace_id: 'workspace-123',
        invitee_email: 'test@example.com',
      };

      expect(metadata.duration).toBe(1000);
      expect(metadata.workspace_id).toBe('workspace-123');
    });
  });

  describe('Notification', () => {
    it('should create valid invite notification object', () => {
      const notification: Notification = {
        id: 'notif-123',
        user_id: 'user-123',
        operation_id: 'invite-456',
        operation_type: 'invite',
        status: 'pending',
        title: 'Invitation sent',
        message: 'Your invitation has been sent',
        metadata: {
          workspace_id: 'workspace-123',
          invitee_email: 'test@example.com',
          role: 'contributor',
          invite_status: 'sent',
        },
        read: false,
        created_at: '2025-10-07T00:00:00Z',
        updated_at: '2025-10-07T00:00:00Z',
      };

      expect(notification.operation_type).toBe('invite');
      expect(notification.status).toBe('pending');
      expect(notification.metadata.invite_status).toBe('sent');
    });

    it('should create valid completed invite notification', () => {
      const notification: Notification = {
        id: 'notif-789',
        user_id: 'user-123',
        operation_id: 'invite-456',
        operation_type: 'invite',
        status: 'completed',
        title: 'Invitation accepted',
        message: 'User has joined your workspace',
        metadata: {
          workspace_id: 'workspace-123',
          workspace_name: 'Test Workspace',
          invitee_email: 'test@example.com',
          invitee_username: 'testuser',
          role: 'contributor',
          invite_status: 'accepted',
        },
        read: false,
        created_at: '2025-10-07T00:00:00Z',
        updated_at: '2025-10-07T00:01:00Z',
      };

      expect(notification.operation_type).toBe('invite');
      expect(notification.status).toBe('completed');
      expect(notification.metadata.invite_status).toBe('accepted');
      expect(notification.metadata.invitee_username).toBe('testuser');
    });
  });

  describe('CreateNotificationParams', () => {
    it('should create valid params for invite sent notification', () => {
      const params: CreateNotificationParams = {
        operation_id: 'invite-456',
        operation_type: 'invite',
        status: 'pending',
        title: 'Invitation sent to test@example.com',
        message: 'Your invitation to join Test Workspace has been sent',
        metadata: {
          workspace_id: 'workspace-123',
          workspace_name: 'Test Workspace',
          invitee_email: 'test@example.com',
          role: 'contributor',
          invite_status: 'sent',
        },
      };

      expect(params.operation_type).toBe('invite');
      expect(params.status).toBe('pending');
      expect(params.metadata?.invite_status).toBe('sent');
    });

    it('should create valid params for invite accepted notification', () => {
      const params: CreateNotificationParams = {
        operation_id: 'invite-456',
        operation_type: 'invite',
        status: 'completed',
        title: 'testuser accepted your invitation',
        message: 'testuser has joined Test Workspace',
        metadata: {
          workspace_id: 'workspace-123',
          workspace_name: 'Test Workspace',
          invitee_email: 'test@example.com',
          invitee_username: 'testuser',
          role: 'contributor',
          invite_status: 'accepted',
        },
      };

      expect(params.operation_type).toBe('invite');
      expect(params.status).toBe('completed');
      expect(params.metadata?.invite_status).toBe('accepted');
    });
  });
});
