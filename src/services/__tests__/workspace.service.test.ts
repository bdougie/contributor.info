import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceService } from '../workspace.service';
import { supabase } from '@/lib/supabase';
import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  AddRepositoryRequest,
} from '@/types/workspace';

// Mock types for Supabase query builder
interface MockQueryBuilder {
  select?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
  eq?: ReturnType<typeof vi.fn>;
  neq?: ReturnType<typeof vi.fn>;
  gt?: ReturnType<typeof vi.fn>;
  gte?: ReturnType<typeof vi.fn>;
  lt?: ReturnType<typeof vi.fn>;
  lte?: ReturnType<typeof vi.fn>;
  like?: ReturnType<typeof vi.fn>;
  ilike?: ReturnType<typeof vi.fn>;
  in?: ReturnType<typeof vi.fn>;
  order?: ReturnType<typeof vi.fn>;
  limit?: ReturnType<typeof vi.fn>;
  single?: ReturnType<typeof vi.fn>;
  maybeSingle?: ReturnType<typeof vi.fn>;
  [key: string]: unknown;
}

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('WorkspaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createWorkspace', () => {
    const mockUserId = 'user-123';
    const mockWorkspaceData: CreateWorkspaceRequest = {
      name: 'Test Workspace',
      description: 'Test Description',
      visibility: 'public',
    };

    it('should create a workspace successfully with free tier limits', async () => {
      let callCount = 0;

      // Setup mocks
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces' && callCount === 0) {
          callCount++;
          // Mock workspace count check
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            }),
          } as MockQueryBuilder;
        }
        if (table === 'subscriptions') {
          // Mock subscription check (no subscription = free tier)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          } as MockQueryBuilder;
        }
        if (table === 'workspaces' && callCount === 1) {
          callCount++;
          // Mock workspace creation
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'workspace-123',
                    name: 'Test Workspace',
                    tier: 'free',
                    max_repositories: 4,
                    current_repository_count: 0,
                  },
                  error: null,
                }),
              }),
            }),
          } as MockQueryBuilder;
        }
        if (table === 'workspace_members') {
          // Mock member creation
          return {
            insert: vi.fn().mockResolvedValue({
              error: null,
            }),
          } as MockQueryBuilder;
        }
        return {} as MockQueryBuilder;
      });

      // Mock slug generation
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'test-workspace',
        error: null,
      });

      // Execute
      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      // Assert
      expect(result.success).toBe(true);
      expect(result._data?.tier).toBe('free');
      expect(result._data?.max_repositories).toBe(4);
      expect(result._data?.current_repository_count).toBe(0);
      expect(result.statusCode).toBe(201);
    });

    it('should create workspace with pro tier limits for pro users', async () => {
      // Mock workspace count check
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: 0,
            error: null,
          }),
        }),
      });

      // Mock pro subscription
      const subscriptionMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  tier: 'pro',
                  max_workspaces: 5,
                  max_repos_per_workspace: 10,
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Mock slug generation
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'test-workspace',
        error: null,
      });

      // Mock workspace creation with pro tier
      const createMock = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'workspace-123',
                name: 'Test Workspace',
                tier: 'pro',
                max_repositories: 10,
                current_repository_count: 0,
                data_retention_days: 90,
              },
              error: null,
            }),
          }),
        }),
      });

      // Setup mocks
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces' && callCount === 0) {
          callCount++;
          return fromMock() as MockQueryBuilder;
        }
        if (table === 'subscriptions') {
          return subscriptionMock() as MockQueryBuilder;
        }
        if (table === 'workspaces') {
          return createMock() as MockQueryBuilder;
        }
        if (table === 'workspace_members') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          } as MockQueryBuilder;
        }
        return {} as MockQueryBuilder;
      });

      // Execute
      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      // Assert
      expect(result.success).toBe(true);
      expect(result._data?.tier).toBe('pro');
      expect(result._data?.max_repositories).toBe(10);
      expect(result.data?._data_retention_days).toBe(90);
    });

    it('should reject workspace creation when limit is reached', async () => {
      let callCount = 0;

      // Setup mocks
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces' && callCount === 0) {
          callCount++;
          // Mock workspace count at limit
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: 1, // At free tier limit
                error: null,
              }),
            }),
          } as MockQueryBuilder;
        }
        if (table === 'subscriptions') {
          // Mock no subscription (free tier)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          } as MockQueryBuilder;
        }
        return {} as MockQueryBuilder;
      });

      // Execute
      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('reached the limit');
      expect(result.statusCode).toBe(403);
    });

    it('should handle validation errors', async () => {
      const invalidData: CreateWorkspaceRequest = {
        name: '', // Invalid: empty name
        description: 'Test',
        visibility: 'public',
      };

      // Execute
      const result = await WorkspaceService.createWorkspace(mockUserId, invalidData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Name is required');
      expect(result.statusCode).toBe(400);
    });
  });

  describe('addRepositoryToWorkspace', () => {
    const mockWorkspaceId = 'workspace-123';
    const mockUserId = 'user-123';
    const mockRepoData: AddRepositoryRequest = {
      repository_id: 'repo-123',
      notes: 'Test repository',
      tags: ['test'],
      is_pinned: false,
    };

    it('should add repository when under limit', async () => {
      // Mock permission check
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: true,
        role: 'owner',
      });

      // Mock existing repo check
      const existingRepoMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null, // No existing repo
                error: null,
              }),
            }),
          }),
        }),
      };

      // Mock workspace limit check
      const workspaceMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                max_repositories: 4,
                current_repository_count: 2, // Under limit
              },
              error: null,
            }),
          }),
        }),
      };

      // Mock add repository
      const addRepoMock = {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'workspace-repo-123',
                workspace_id: mockWorkspaceId,
                repository_id: mockRepoData.repository_id,
              },
              error: null,
            }),
          }),
        }),
      };

      // Mock update workspace count
      const updateMock = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      };

      // Setup mocks
      let callCount = 0;
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspace_repositories' && callCount === 0) {
          callCount++;
          return existingRepoMock as MockQueryBuilder;
        }
        if (table === 'workspaces' && callCount === 1) {
          callCount++;
          return workspaceMock as MockQueryBuilder;
        }
        if (table === 'workspace_repositories') {
          return addRepoMock as MockQueryBuilder;
        }
        if (table === 'workspaces') {
          return updateMock as MockQueryBuilder;
        }
        return {} as MockQueryBuilder;
      });

      // Execute
      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockUserId,
        mockRepoData,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result._data?.repository_id).toBe(mockRepoData.repository_id);
      expect(result.statusCode).toBe(201);
    });

    it('should reject when repository limit is reached', async () => {
      // Mock permission check
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: true,
        role: 'owner',
      });

      // Mock existing repo check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      // Mock workspace at limit
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                max_repositories: 4,
                current_repository_count: 4, // At limit
              },
              error: null,
            }),
          }),
        }),
      });

      // Execute
      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockUserId,
        mockRepoData,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Repository limit reached');
      expect(result.statusCode).toBe(403);
    });

    it('should reject duplicate repository', async () => {
      // Mock permission check
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: true,
        role: 'owner',
      });

      // Mock existing repo found
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'existing-repo' }, // Repository exists
                error: null,
              }),
            }),
          }),
        }),
      });

      // Execute
      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockUserId,
        mockRepoData,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.statusCode).toBe(409);
    });

    it('should reject when user lacks permissions', async () => {
      // Mock permission check - no permission
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: false,
      });

      // Execute
      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockUserId,
        mockRepoData,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
      expect(result.statusCode).toBe(403);
    });
  });

  describe('updateWorkspace', () => {
    const mockWorkspaceId = 'workspace-123';
    const mockUserId = 'user-123';
    const updateData: UpdateWorkspaceRequest = {
      name: 'Updated Name',
      description: 'Updated Description',
    };

    it('should update workspace successfully', async () => {
      // Mock permission check
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'owner' },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Mock update
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: mockWorkspaceId,
                  name: 'Updated Name',
                  description: 'Updated Description',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Execute
      const result = await WorkspaceService.updateWorkspace(
        mockWorkspaceId,
        mockUserId,
        updateData,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result._data?.name).toBe('Updated Name');
      expect(result.statusCode).toBe(200);
    });

    it('should reject update without proper permissions', async () => {
      // Mock permission check - viewer role
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { role: 'viewer' },
                error: null,
              }),
            }),
          }),
        }),
      });

      // Execute
      const result = await WorkspaceService.updateWorkspace(
        mockWorkspaceId,
        mockUserId,
        updateData,
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
      expect(result.statusCode).toBe(403);
    });
  });

  describe('removeRepositoryFromWorkspace', () => {
    const mockWorkspaceId = 'workspace-123';
    const mockRepositoryId = 'repo-123';
    const mockUserId = 'user-123';

    it('should remove repository and update count', async () => {
      // Mock permission check
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: true,
        role: 'owner',
      });

      // Mock delete repository
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      });

      // Mock get current count
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { current_repository_count: 3 },
              error: null,
            }),
          }),
        }),
      });

      // Mock update count
      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      // Execute
      const result = await WorkspaceService.removeRepositoryFromWorkspace(
        mockWorkspaceId,
        mockRepositoryId,
        mockUserId,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });
  });
});
