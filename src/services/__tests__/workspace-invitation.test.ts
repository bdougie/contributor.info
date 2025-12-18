import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceService } from '../workspace.service';
import { supabase } from '@/lib/supabase';
import type { MockSupabaseResponse } from './test-types';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock WorkspacePrioritySync and Inngest to avoid errors
vi.mock('@/lib/progressive-capture/workspace-priority-sync', () => ({
  workspacePrioritySync: {
    markAsWorkspaceRepo: vi.fn(),
  },
}));

vi.mock('@/lib/inngest/client-safe', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

describe('WorkspaceService - Invitation Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('validateInvitation', () => {
    const mockToken = '12345678-1234-1234-1234-123456789012';

    it('should validate invitation using RPC', async () => {
      const mockInvitationData = {
        id: 'invitation-123',
        workspace_id: 'workspace-123',
        role: 'editor',
        expires_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        status: 'pending',
        workspace: {
          id: 'workspace-123',
          name: 'Test Workspace',
          slug: 'test-workspace',
          description: 'Test Description',
        }
      };

      // Mock RPC response
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockInvitationData,
        error: null,
      } as MockSupabaseResponse);

      // Execute
      const result = await WorkspaceService.validateInvitation(mockToken);

      // Assert
      expect(supabase.rpc).toHaveBeenCalledWith('get_workspace_invitation_by_token', {
        p_invitation_token: mockToken,
      });
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(mockInvitationData.id);
      expect(result.data?.workspace.name).toBe(mockInvitationData.workspace.name);
      expect(result.statusCode).toBe(200);
    });

    it('should return error when invitation is not found', async () => {
      // Mock RPC response with null data
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: null,
      } as MockSupabaseResponse);

      // Execute
      const result = await WorkspaceService.validateInvitation(mockToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invitation not found');
      expect(result.statusCode).toBe(404);
    });

    it('should return error when RPC fails', async () => {
      // Mock RPC response with error
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      } as unknown as MockSupabaseResponse);

      // Execute
      const result = await WorkspaceService.validateInvitation(mockToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to validate invitation');
      expect(result.statusCode).toBe(500);
    });

    it('should return error when invitation is expired', async () => {
      const mockInvitationData = {
        id: 'invitation-123',
        expires_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        status: 'pending',
      };

      // Mock RPC response
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: mockInvitationData,
        error: null,
      } as MockSupabaseResponse);

      // Mock update for expired status
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      vi.mocked(supabase.from).mockReturnValue({
        update: updateMock,
      } as any);

      // Execute
      const result = await WorkspaceService.validateInvitation(mockToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invitation has expired');
      expect(result.statusCode).toBe(410);

      // Verify update was called
      expect(supabase.from).toHaveBeenCalledWith('workspace_invitations');
      expect(updateMock).toHaveBeenCalledWith({ status: 'expired' });
    });
  });

  describe('declineInvitation', () => {
    const mockToken = '12345678-1234-1234-1234-123456789012';

    it('should decline invitation using RPC', async () => {
      // Mock RPC response
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{ success: true }],
        error: null,
      } as MockSupabaseResponse);

      // Execute
      const result = await WorkspaceService.declineInvitation(mockToken);

      // Assert
      expect(supabase.rpc).toHaveBeenCalledWith('decline_workspace_invitation', {
        p_invitation_token: mockToken,
      });
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('should handle RPC failure', async () => {
      // Mock RPC response with error
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      } as unknown as MockSupabaseResponse);

      // Execute
      const result = await WorkspaceService.declineInvitation(mockToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to decline invitation');
      expect(result.statusCode).toBe(500);
    });

    it('should handle RPC logic error (e.g., invitation not found)', async () => {
      // Mock RPC response with success: false
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: [{ success: false, error_message: 'Invitation not found' }],
        error: null,
      } as MockSupabaseResponse);

      // Execute
      const result = await WorkspaceService.declineInvitation(mockToken);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invitation not found');
      expect(result.statusCode).toBe(404);
    });
  });
});
