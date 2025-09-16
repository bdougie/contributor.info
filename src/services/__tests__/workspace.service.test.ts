import { describe, it, expect, vi, beforeEach, afterEach, MockedFunction } from 'vitest';
import { WorkspaceService } from '../workspace.service';
import { supabase } from '@/lib/supabase';
import { WorkspacePermissionService } from '../workspace-permissions.service';
import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  AddRepositoryRequest,
  WorkspaceRole,
} from '@/types/workspace';

// Type definitions for Supabase mock responses
interface SupabaseQueryBuilder<T = unknown> {
  select: MockedFunction<(query?: string) => SupabaseQueryBuilder<T>>;
  insert: MockedFunction<(data: unknown) => SupabaseQueryBuilder<T>>;
  update: MockedFunction<(data: unknown) => SupabaseQueryBuilder<T>>;
  delete: MockedFunction<() => SupabaseQueryBuilder<T>>;
  eq: MockedFunction<
    (column: string, value: unknown) => SupabaseQueryBuilder<T> | Promise<SupabaseResponse<T>>
  >;
  maybeSingle: MockedFunction<() => Promise<SupabaseResponse<T>>>;
  single: MockedFunction<() => Promise<SupabaseResponse<T>>>;
  order: MockedFunction<
    (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder<T>
  >;
  range: MockedFunction<(from: number, to: number) => SupabaseQueryBuilder<T>>;
  or: MockedFunction<(filters: string) => SupabaseQueryBuilder<T>>;
}

interface SupabaseResponse<T = unknown> {
  data: T | null;
  error: { message?: string; code?: string } | null;
  count?: number | null;
}

interface WorkspaceData {
  id: string;
  name: string;
  tier: string;
  max_repositories: number;
  current_repository_count: number;
  data_retention_days?: number;
  owner_id?: string;
  subscription_tier?: string;
  workspace_members?: Array<{
    id?: string;
    user_id: string;
    role: string;
    accepted_at: Date;
  }>;
}

interface MemberData {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  user?: { email: string };
}

interface RepositoryData {
  id: string;
  workspace_id: string;
  repository_id: string;
}

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// Mock WorkspacePermissionService
vi.mock('../workspace-permissions.service', () => ({
  WorkspacePermissionService: {
    getTierLimits: vi.fn(),
    canInviteMembers: vi.fn(),
    hasPermission: vi.fn(),
  },
}));

// Helper function to create a mock query builder
function createMockQueryBuilder<T = unknown>(
  response: SupabaseResponse<T>
): SupabaseQueryBuilder<T> {
  const mockBuilder: Partial<SupabaseQueryBuilder<T>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(response),
    single: vi.fn().mockResolvedValue(response),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
  };

  // Set up method chaining
  Object.keys(mockBuilder).forEach((key) => {
    const method = mockBuilder[key as keyof SupabaseQueryBuilder<T>];
    if (method && key !== 'maybeSingle' && key !== 'single') {
      (method as MockedFunction<() => SupabaseQueryBuilder<T>>).mockReturnValue(
        mockBuilder as SupabaseQueryBuilder<T>
      );
    }
  });

  return mockBuilder as SupabaseQueryBuilder<T>;
}

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

      // Mock getTierLimits
      vi.mocked(WorkspacePermissionService.getTierLimits).mockReturnValue({
        maxMembers: 1,
        maxRepositories: 3,
        features: ['basic_analytics'],
      });

      // Setup mocks
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces' && callCount === 0) {
          callCount++;
          // Mock workspace count check
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
            count: 0,
          };
          const mockBuilder = createMockQueryBuilder(response);
          mockBuilder.eq = vi.fn().mockResolvedValue(response);
          return mockBuilder as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'subscriptions') {
          // Mock subscription check (no subscription = free tier)
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'workspaces' && callCount === 1) {
          callCount++;
          // Mock workspace creation
          const response: SupabaseResponse<WorkspaceData> = {
            data: {
              id: 'workspace-123',
              name: 'Test Workspace',
              tier: 'free',
              max_repositories: 3,
              current_repository_count: 0,
            },
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'workspace_members') {
          // Mock member creation
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
          };
          const mockBuilder = createMockQueryBuilder(response);
          mockBuilder.insert = vi.fn().mockResolvedValue(response);
          return mockBuilder as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as ReturnType<typeof supabase.from>;
      });

      // Mock slug generation
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'test-workspace',
        error: null,
      } as SupabaseResponse<string>);

      // Execute
      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.tier).toBe('free');
      expect(result.data?.max_repositories).toBe(3);
      expect(result.data?.current_repository_count).toBe(0);
      expect(result.statusCode).toBe(201);
    });

    it('should create workspace with team tier limits', async () => {
      let callCount = 0;

      // Mock getTierLimits for team tier
      vi.mocked(WorkspacePermissionService.getTierLimits).mockReturnValue({
        maxMembers: 5,
        maxRepositories: 3,
        features: ['advanced_analytics', 'team_collaboration'],
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces' && callCount === 0) {
          callCount++;
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
            count: 0,
          };
          const mockBuilder = createMockQueryBuilder(response);
          mockBuilder.eq = vi.fn().mockResolvedValue(response);
          return mockBuilder as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'subscriptions') {
          const response: SupabaseResponse<{
            tier: string;
            max_workspaces: number;
            max_repos_per_workspace: number;
          }> = {
            data: {
              tier: 'team',
              max_workspaces: 3,
              max_repos_per_workspace: 3,
            },
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'workspaces' && callCount === 1) {
          callCount++;
          const response: SupabaseResponse<WorkspaceData> = {
            data: {
              id: 'workspace-456',
              name: 'Test Workspace',
              tier: 'team',
              max_repositories: 3,
              current_repository_count: 0,
              data_retention_days: 30,
            },
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'workspace_members') {
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
          };
          const mockBuilder = createMockQueryBuilder(response);
          mockBuilder.insert = vi.fn().mockResolvedValue(response);
          return mockBuilder as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as ReturnType<typeof supabase.from>;
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'test-workspace',
        error: null,
      } as SupabaseResponse<string>);

      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      expect(result.success).toBe(true);
      expect(result.data?.tier).toBe('team');
      expect(result.data?.max_repositories).toBe(3);
      expect(result.data?.data_retention_days).toBe(30);
    });

    it('should handle slug generation failure', async () => {
      // Mock for getTierLimits
      vi.mocked(WorkspacePermissionService.getTierLimits).mockReturnValue({
        maxMembers: 1,
        maxRepositories: 3,
        features: [],
      });

      // Mock for workspaces count check
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces') {
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
            count: 0,
          };
          const mockBuilder = createMockQueryBuilder(response);
          // Chain eq methods properly
          mockBuilder.eq = vi.fn().mockReturnValue({
            ...mockBuilder,
            eq: vi.fn().mockResolvedValue(response),
          });
          return mockBuilder as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'subscriptions') {
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as ReturnType<typeof supabase.from>;
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Failed to generate slug' },
      } as SupabaseResponse<null>);

      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate workspace slug');
      expect(result.statusCode).toBe(500);
    });

    it('should rollback workspace creation if member creation fails', async () => {
      let callCount = 0;
      const deleteWorkspaceMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(WorkspacePermissionService.getTierLimits).mockReturnValue({
        maxMembers: 1,
        maxRepositories: 3,
        features: [],
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces' && callCount === 0) {
          callCount++;
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
            count: 0,
          };
          const mockBuilder = createMockQueryBuilder(response);
          mockBuilder.eq = vi.fn().mockReturnValue({
            ...mockBuilder,
            eq: vi.fn().mockResolvedValue(response),
          });
          return mockBuilder as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'subscriptions') {
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'workspaces' && callCount === 1) {
          callCount++;
          const response: SupabaseResponse<WorkspaceData> = {
            data: {
              id: 'workspace-123',
              name: 'Test Workspace',
              tier: 'free',
              max_repositories: 3,
              current_repository_count: 0,
            },
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'workspaces' && callCount === 2) {
          // Rollback delete
          return {
            delete: vi.fn().mockReturnValue({
              eq: deleteWorkspaceMock.mockReturnValue({
                single: vi.fn().mockResolvedValue({ error: null }),
              }),
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'workspace_members') {
          return {
            insert: vi.fn().mockResolvedValue({
              error: { message: 'Member creation failed' },
            }),
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as ReturnType<typeof supabase.from>;
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'test-workspace',
        error: null,
      } as SupabaseResponse<string>);

      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to create workspace');
      expect(deleteWorkspaceMock).toHaveBeenCalledWith('id', 'workspace-123');
    });

    it('should handle duplicate workspace name error', async () => {
      let callCount = 0;

      vi.mocked(WorkspacePermissionService.getTierLimits).mockReturnValue({
        maxMembers: 1,
        maxRepositories: 3,
        features: [],
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces' && callCount === 0) {
          callCount++;
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
            count: 0,
          };
          const mockBuilder = createMockQueryBuilder(response);
          mockBuilder.eq = vi.fn().mockResolvedValue(response);
          return mockBuilder as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'subscriptions') {
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'workspaces' && callCount === 1) {
          callCount++;
          const response: SupabaseResponse<null> = {
            data: null,
            error: { code: '23505' },
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as ReturnType<typeof supabase.from>;
      });

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'test-workspace',
        error: null,
      } as SupabaseResponse<string>);

      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('workspace with this name already exists');
      expect(result.statusCode).toBe(409);
    });

    it('should reject workspace creation when limit is reached', async () => {
      let workspaceCallCount = 0;

      vi.mocked(WorkspacePermissionService.getTierLimits).mockReturnValue({
        maxMembers: 1,
        maxRepositories: 3,
        features: [],
      });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workspaces') {
          workspaceCallCount++;
          if (workspaceCallCount === 1) {
            // First call for count check
            const response: SupabaseResponse<null> = {
              data: null,
              error: null,
              count: 1, // At limit
            };
            const mockBuilder = createMockQueryBuilder(response);
            // The service only calls eq once for owner_id
            mockBuilder.eq = vi.fn().mockResolvedValue(response);
            return mockBuilder as unknown as ReturnType<typeof supabase.from>;
          }
          // Should never get here if limit check works
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        if (table === 'subscriptions') {
          const response: SupabaseResponse<null> = {
            data: null,
            error: null,
          };
          return createMockQueryBuilder(response) as unknown as ReturnType<typeof supabase.from>;
        }
        return {} as ReturnType<typeof supabase.from>;
      });

      // Mock rpc call - should not be reached due to limit
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: 'test-workspace',
        error: null,
      } as SupabaseResponse<string>);

      const result = await WorkspaceService.createWorkspace(mockUserId, mockWorkspaceData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('You have reached the limit of 1 workspaces for your current plan');
      expect(result.statusCode).toBe(403);
    });

    it('should handle validation errors', async () => {
      const invalidData: CreateWorkspaceRequest = {
        name: '', // Invalid: empty name
        description: 'Test',
        visibility: 'public',
      };

      const result = await WorkspaceService.createWorkspace(mockUserId, invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Name is required');
      expect(result.statusCode).toBe(400);
    });
  });

  describe('deleteWorkspace', () => {
    const mockWorkspaceId = 'workspace-123';
    const mockUserId = 'user-123';

    it('should delete workspace successfully when user is owner', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: { owner_id: mockUserId },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await WorkspaceService.deleteWorkspace(mockWorkspaceId, mockUserId);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('should reject deletion when user is not owner', async () => {
      vi.mocked(supabase.from).mockReturnValue(
        createMockQueryBuilder({
          data: { owner_id: 'different-user' },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await WorkspaceService.deleteWorkspace(mockWorkspaceId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Only workspace owner can delete workspace');
      expect(result.statusCode).toBe(403);
    });

    it('should return 404 when workspace not found', async () => {
      vi.mocked(supabase.from).mockReturnValue(
        createMockQueryBuilder({
          data: null,
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await WorkspaceService.deleteWorkspace(mockWorkspaceId, mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Workspace not found');
      expect(result.statusCode).toBe(404);
    });
  });

  describe('updateMemberRole', () => {
    const mockWorkspaceId = 'workspace-123';
    const mockRequestingUserId = 'user-123';
    const mockTargetUserId = 'user-456';
    const mockNewRole: WorkspaceRole = 'maintainer';

    it('should update member role successfully', async () => {
      vi.mocked(WorkspacePermissionService.hasPermission).mockReturnValue(true);

      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder<WorkspaceData>({
          data: {
            id: mockWorkspaceId,
            name: 'Test Workspace',
            tier: 'team',
            max_repositories: 10,
            current_repository_count: 0,
            owner_id: mockRequestingUserId,
            workspace_members: [
              { id: '1', user_id: mockRequestingUserId, role: 'owner', accepted_at: new Date() },
              { id: '2', user_id: mockTargetUserId, role: 'contributor', accepted_at: new Date() },
            ],
          },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const updateResponse: SupabaseResponse<MemberData> = {
        data: {
          id: '2',
          workspace_id: mockWorkspaceId,
          user_id: mockTargetUserId,
          role: mockNewRole,
          user: { email: 'target@test.com' },
        },
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(updateResponse),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await WorkspaceService.updateMemberRole(
        mockWorkspaceId,
        mockRequestingUserId,
        mockTargetUserId,
        mockNewRole
      );

      expect(result.success).toBe(true);
      expect(result.data?.role).toBe(mockNewRole);
      expect(result.statusCode).toBe(200);
    });

    it('should prevent changing to owner role', async () => {
      const result = await WorkspaceService.updateMemberRole(
        mockWorkspaceId,
        mockRequestingUserId,
        mockTargetUserId,
        'owner'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Ownership transfer requires a separate process');
      expect(result.statusCode).toBe(400);
    });

    it('should prevent self-demotion from owner', async () => {
      vi.mocked(supabase.from).mockReturnValue(
        createMockQueryBuilder<WorkspaceData>({
          data: {
            id: mockWorkspaceId,
            name: 'Test Workspace',
            tier: 'team',
            max_repositories: 10,
            current_repository_count: 0,
            owner_id: mockRequestingUserId,
            workspace_members: [
              { id: '1', user_id: mockRequestingUserId, role: 'owner', accepted_at: new Date() },
            ],
          },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await WorkspaceService.updateMemberRole(
        mockWorkspaceId,
        mockRequestingUserId,
        mockRequestingUserId,
        'maintainer'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot demote yourself from owner role');
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
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: true,
        role: 'owner',
      });

      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: null, // No existing repo
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: {
            max_repositories: 4,
            current_repository_count: 2, // Under limit
          },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder<RepositoryData>({
          data: {
            id: 'workspace-repo-123',
            workspace_id: mockWorkspaceId,
            repository_id: mockRepoData.repository_id,
          },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockUserId,
        mockRepoData
      );

      expect(result.success).toBe(true);
      expect(result.data?.repository_id).toBe(mockRepoData.repository_id);
      expect(result.statusCode).toBe(201);
    });

    it('should reject when repository limit is reached', async () => {
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: true,
        role: 'owner',
      });

      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: null,
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: {
            max_repositories: 4,
            current_repository_count: 4, // At limit
          },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockUserId,
        mockRepoData
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Repository limit reached');
      expect(result.statusCode).toBe(403);
    });

    it('should reject duplicate repository', async () => {
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: true,
        role: 'owner',
      });

      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: { id: 'existing-repo' }, // Repository exists
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockUserId,
        mockRepoData
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
      expect(result.statusCode).toBe(409);
    });

    it('should reject when user lacks permissions', async () => {
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: false,
      });

      const result = await WorkspaceService.addRepositoryToWorkspace(
        mockWorkspaceId,
        mockUserId,
        mockRepoData
      );

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
      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: { role: 'owner' },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const updateResponse: SupabaseResponse<WorkspaceData> = {
        data: {
          id: mockWorkspaceId,
          name: 'Updated Name',
          tier: 'free',
          max_repositories: 3,
          current_repository_count: 0,
        },
        error: null,
      };

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(updateResponse),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await WorkspaceService.updateWorkspace(
        mockWorkspaceId,
        mockUserId,
        updateData
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Updated Name');
      expect(result.statusCode).toBe(200);
    });

    it('should reject update without proper permissions', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: { role: 'contributor' },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      const result = await WorkspaceService.updateWorkspace(
        mockWorkspaceId,
        mockUserId,
        updateData
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
      expect(result.statusCode).toBe(403);
    });

    it('should handle workspace not found error', async () => {
      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: { role: 'owner' },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await WorkspaceService.updateWorkspace(
        mockWorkspaceId,
        mockUserId,
        updateData
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Workspace not found');
      expect(result.statusCode).toBe(404);
    });
  });

  describe('removeRepositoryFromWorkspace', () => {
    const mockWorkspaceId = 'workspace-123';
    const mockRepositoryId = 'repo-123';
    const mockUserId = 'user-123';

    it('should remove repository and update count', async () => {
      const permissionCheckSpy = vi.spyOn(WorkspaceService, 'checkPermission');
      permissionCheckSpy.mockResolvedValue({
        hasPermission: true,
        role: 'owner',
      });

      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      vi.mocked(supabase.from).mockReturnValueOnce(
        createMockQueryBuilder({
          data: { current_repository_count: 3 },
          error: null,
        }) as unknown as ReturnType<typeof supabase.from>
      );

      vi.mocked(supabase.from).mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const result = await WorkspaceService.removeRepositoryFromWorkspace(
        mockWorkspaceId,
        mockRepositoryId,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });
  });
});
