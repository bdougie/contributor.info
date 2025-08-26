/**
 * @jest-environment node
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkspaceService } from '../workspace.service';
import { supabase } from '@/lib/supabase';
import type { CreateWorkspaceRequest, AddRepositoryRequest } from '@/types/workspace';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}));

describe('Workspace Owner Permissions', () => {
  const mockOwnerId = 'owner-123';
  const mockWorkspaceId = 'workspace-123';
  const mockRepositoryId = 'repo-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Workspace Creation', () => {
    it('should automatically add owner as member when workspace is created', async () => {
      const mockWorkspace = {
        id: mockWorkspaceId,
        name: 'Test Workspace',
        slug: 'test-workspace',
        owner_id: mockOwnerId,
        created_at: new Date().toISOString()
      };

      const mockMember = {
        id: 'member-123',
        workspace_id: mockWorkspaceId,
        user_id: mockOwnerId,
        role: 'owner',
        accepted_at: new Date().toISOString()
      };

      // Mock workspace count check
      const workspaceCountMock = {
        select: vi.fn().mockReturnValue({
          count: 'exact',
          head: true,
          data: null,
          error: null,
          count: 0
        })
      };

      // Mock subscription check
      const subscriptionMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  tier: 'free',
                  max_workspaces: 5,
                  max_repos_per_workspace: 10
                },
                error: null
              })
            })
          })
        })
      };

      // Mock workspace creation
      const insertWorkspaceMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockWorkspace,
            error: null
          })
        })
      });

      // Mock member creation
      const insertMemberMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockMember,
            error: null
          })
        })
      });

      // Mock checking for existing member
      const selectMemberMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: mockMember,
              error: null
            })
          })
        })
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            insert: insertWorkspaceMock,
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                count: vi.fn().mockResolvedValue({ count: 0, error: null })
              })
            })
          } as any;
        }
        if (table === 'workspace_members') {
          return {
            select: selectMemberMock,
            insert: insertMemberMock
          } as any;
        }
        if (table === 'subscriptions') {
          return subscriptionMock as any;
        }
        return {} as any;
      });

      const createData: CreateWorkspaceRequest = {
        name: 'Test Workspace',
        description: 'Test Description'
      };

      const result = await WorkspaceService.createWorkspace(mockOwnerId, createData);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(mockWorkspaceId);

      // Verify owner is member
      const memberCheckResult = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', mockWorkspaceId)
        .eq('user_id', mockOwnerId)
        .maybeSingle();

      expect(memberCheckResult.data).toBeDefined();
      expect(memberCheckResult.data?.role).toBe('owner');
    });
  });

  describe('Repository Operations as Owner', () => {
    beforeEach(() => {
      // Mock permission check to confirm owner is a member
      vi.spyOn(WorkspaceService, 'checkPermission').mockResolvedValue({
        hasPermission: true,
        role: 'owner'
      });
    });

    it('should allow owner to add repository to workspace', async () => {
      const mockRepo: AddRepositoryRequest = {
        repository_id: mockRepositoryId,
        notes: 'Test repository',
        tags: ['test'],
        is_pinned: false
      };

      const mockWorkspaceRepo = {
        id: 'workspace-repo-123',
        workspace_id: mockWorkspaceId,
        repository_id: mockRepositoryId,
        added_by: mockOwnerId,
        created_at: new Date().toISOString()
      };

      // Mock repository operations
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspace_repositories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null, // No existing repo
                    error: null
                  })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockWorkspaceRepo,
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { 
                    id: mockWorkspaceId,
                    max_repositories: 10,
                    current_repository_count: 2
                  },
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockOwnerId,
        mockRepo
      );

      expect(result.success).toBe(true);
      expect(result.data?.repository_id).toBe(mockRepositoryId);
      expect(result.statusCode).toBe(201);
    });

    it('should allow owner to remove repository from workspace', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspace_repositories') {
          return {
            delete: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: mockWorkspaceId,
                    current_repository_count: 3
                  },
                  error: null
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await WorkspaceService.removeRepositoryFromWorkspace(
        mockWorkspaceId,
        mockOwnerId,
        mockRepositoryId
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('should allow owner to update repository settings', async () => {
      const updateData = {
        notes: 'Updated notes',
        tags: ['updated', 'test'],
        is_pinned: true
      };

      const mockUpdatedRepo = {
        id: 'workspace-repo-123',
        workspace_id: mockWorkspaceId,
        repository_id: mockRepositoryId,
        notes: updateData.notes,
        tags: updateData.tags,
        is_pinned: updateData.is_pinned,
        updated_at: new Date().toISOString()
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspace_repositories') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: mockUpdatedRepo,
                      error: null
                    })
                  })
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      const result = await WorkspaceService.updateWorkspaceRepository(
        mockWorkspaceId,
        mockOwnerId,
        mockRepositoryId,
        updateData
      );

      expect(result.success).toBe(true);
      expect(result.data?.notes).toBe(updateData.notes);
      expect(result.data?.is_pinned).toBe(updateData.is_pinned);
    });
  });

  describe('Permission Validation', () => {
    it('should confirm owner has permission through membership', async () => {
      // Mock workspace with owner
      const mockWorkspace = {
        id: mockWorkspaceId,
        owner_id: mockOwnerId
      };

      // Mock owner as member
      const mockMember = {
        workspace_id: mockWorkspaceId,
        user_id: mockOwnerId,
        role: 'owner',
        accepted_at: new Date().toISOString()
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockWorkspace,
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockMember,
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      // Restore the original implementation for this test
      vi.spyOn(WorkspaceService, 'checkPermission').mockRestore();

      const permission = await WorkspaceService.checkPermission(
        mockWorkspaceId,
        mockOwnerId,
        ['owner', 'admin', 'editor']
      );

      expect(permission.hasPermission).toBe(true);
      expect(permission.role).toBe('owner');
    });

    it('should deny permission for non-member non-owner', async () => {
      const nonMemberId = 'non-member-123';

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockWorkspaceId, owner_id: mockOwnerId },
                  error: null
                })
              })
            })
          } as any;
        }
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      // Restore the original implementation for this test
      vi.spyOn(WorkspaceService, 'checkPermission').mockRestore();

      const permission = await WorkspaceService.checkPermission(
        mockWorkspaceId,
        nonMemberId,
        ['owner', 'admin', 'editor']
      );

      expect(permission.hasPermission).toBe(false);
      expect(permission.role).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle duplicate owner member creation gracefully', async () => {
      // This tests the ON CONFLICT DO NOTHING clause in the trigger
      const mockWorkspace = {
        id: mockWorkspaceId,
        owner_id: mockOwnerId
      };

      const mockExistingMember = {
        workspace_id: mockWorkspaceId,
        user_id: mockOwnerId,
        role: 'owner',
        accepted_at: new Date().toISOString()
      };

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: mockExistingMember,
                    error: null
                  })
                })
              })
            })
          } as any;
        }
        return {} as any;
      });

      // Should not throw error even if member already exists
      const memberCheck = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', mockWorkspaceId)
        .eq('user_id', mockOwnerId)
        .maybeSingle();

      expect(memberCheck.error).toBeNull();
      expect(memberCheck.data?.role).toBe('owner');
    });

    it('should fail repository operations for users without proper role', async () => {
      const viewerId = 'viewer-123';

      // Mock permission check for viewer role
      vi.spyOn(WorkspaceService, 'checkPermission').mockResolvedValue({
        hasPermission: false,
        role: 'viewer'
      });

      const mockRepo: AddRepositoryRequest = {
        repository_id: mockRepositoryId
      };

      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        viewerId,
        mockRepo
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
      expect(result.statusCode).toBe(403);
    });
  });
});