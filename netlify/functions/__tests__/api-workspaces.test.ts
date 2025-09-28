import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Supabase before importing handler
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  })),
}));

import { createClient } from '@supabase/supabase-js';
import handler from '../api-workspaces.mts';

describe('Workspace API Integration Tests', () => {
  let mockSupabase: any;
  let mockAuth: any;
  let mockFrom: any;

  beforeEach(() => {
    // Reset mocks
    mockAuth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: null
      }),
    };

    mockFrom = vi.fn();

    mockSupabase = {
      auth: mockAuth,
      from: mockFrom,
      rpc: vi.fn(),
    };

    (createClient as any).mockReturnValue(mockSupabase);

    // Mock environment variables
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 for unauthenticated requests', async () => {
      mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const request = new Request('https://example.com/api/workspaces', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 for invalid token', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      const request = new Request('https://example.com/api/workspaces', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should accept valid authentication', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

      const mockWorkspaces = [{ id: 'ws-1', name: 'Workspace 1' }];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockWorkspaces,
          error: null,
          count: 1,
        }),
      };

      mockFrom.mockReturnValue(mockQuery);

      const request = new Request('https://example.com/api/workspaces', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workspaces).toEqual(mockWorkspaces);
    });
  });

  describe('GET /api/workspaces', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    });

    it('should list user workspaces with pagination', async () => {
      const mockWorkspaces = [
        { id: 'ws-1', name: 'Workspace 1' },
        { id: 'ws-2', name: 'Workspace 2' },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: mockWorkspaces,
          error: null,
          count: 10,
        }),
      };

      mockFrom.mockReturnValue(mockQuery);

      const request = new Request('https://example.com/api/workspaces?page=2&limit=5', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workspaces).toEqual(mockWorkspaces);
      expect(data.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2,
      });
      expect(mockQuery.range).toHaveBeenCalledWith(5, 9);
    });

    it('should filter by visibility', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockFrom.mockReturnValue(mockQuery);

      const request = new Request('https://example.com/api/workspaces?visibility=private', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      await handler(request, {} as any);

      expect(mockQuery.eq).toHaveBeenCalledWith('visibility', 'private');
    });

    it('should search workspaces', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: [],
          error: null,
          count: 0,
        }),
      };

      mockFrom.mockReturnValue(mockQuery);

      const request = new Request('https://example.com/api/workspaces?search=test', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      await handler(request, {} as any);

      expect(mockQuery.or).toHaveBeenCalledWith('name.ilike.%test%,description.ilike.%test%');
    });
  });

  describe('GET /api/workspaces/:id', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    });

    it('should get specific workspace', async () => {
      const mockWorkspace = {
        id: 'ws-123',
        name: 'Test Workspace',
        workspace_members: [{ user_id: 'user-123', role: 'owner' }],
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockWorkspace,
          error: null,
        }),
      };

      mockFrom.mockReturnValue(mockQuery);

      const request = new Request('https://example.com/api/workspaces/ws-123', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workspace).toEqual(mockWorkspace);
    });

    it('should return 404 for non-existent workspace', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      mockFrom.mockReturnValue(mockQuery);

      const request = new Request('https://example.com/api/workspaces/non-existent', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Workspace not found or access denied');
    });
  });

  describe('POST /api/workspaces', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    });

    it('should create new workspace', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'test-workspace-slug',
        error: null,
      });

      const mockWorkspace = {
        id: 'ws-new',
        name: 'New Workspace',
        slug: 'test-workspace-slug',
      };

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockWorkspace,
          error: null,
        }),
      };

      const memberQuery = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'workspaces') return insertQuery;
        if (table === 'workspace_members') return memberQuery;
        return null;
      });

      const request = new Request('https://example.com/api/workspaces', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Workspace',
          description: 'Test description',
          visibility: 'public',
        }),
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.workspace).toEqual(mockWorkspace);
      expect(memberQuery.insert).toHaveBeenCalledWith({
        workspace_id: 'ws-new',
        user_id: 'user-123',
        role: 'owner',
      });
    });

    it('should validate workspace data', async () => {
      const request = new Request('https://example.com/api/workspaces', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: '',
          visibility: 'invalid',
        }),
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Validation failed');
      expect(data.errors).toContain('Name must be between 1 and 100 characters');
    });

    it('should handle duplicate workspace names', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'test-workspace-slug',
        error: null,
      });

      const insertQuery = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505' },
        }),
      };

      mockFrom.mockReturnValue(insertQuery);

      const request = new Request('https://example.com/api/workspaces', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Duplicate Workspace',
        }),
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('A workspace with this name already exists');
    });
  });

  describe('PUT /api/workspaces/:id', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    });

    it('should update workspace', async () => {
      const memberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'owner' },
          error: null,
        }),
      };

      const updateQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'ws-123', name: 'Updated Workspace' },
          error: null,
        }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'workspace_members') return memberQuery;
        if (table === 'workspaces') return updateQuery;
        return null;
      });

      const request = new Request('https://example.com/api/workspaces/ws-123', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Workspace',
        }),
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.workspace.name).toBe('Updated Workspace');
    });

    it('should check permissions for update', async () => {
      const memberQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { role: 'viewer' },
          error: null,
        }),
      };

      mockFrom.mockReturnValue(memberQuery);

      const request = new Request('https://example.com/api/workspaces/ws-123', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Workspace',
        }),
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('DELETE /api/workspaces/:id', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    });

    it('should delete workspace if owner', async () => {
      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { owner_id: 'user-123' },
          error: null,
        }),
      };

      const deleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'workspaces' && !deleteQuery.delete.mock.calls.length) {
          return selectQuery;
        }
        return deleteQuery;
      });

      const request = new Request('https://example.com/api/workspaces/ws-123', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should prevent non-owner from deleting', async () => {
      const selectQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { owner_id: 'other-user' },
          error: null,
        }),
      };

      mockFrom.mockReturnValue(selectQuery);

      const request = new Request('https://example.com/api/workspaces/ws-123', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only workspace owner can delete workspace');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      const mockUser = { id: 'user-123', email: 'test@example.com' };
      mockAuth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    });

    it('should handle internal server errors gracefully', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = new Request('https://example.com/api/workspaces', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
      expect(data.message).toBe('Database connection failed');
    });

    it('should return 405 for unsupported methods', async () => {
      const request = new Request('https://example.com/api/workspaces', {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.error).toBe('Method not allowed');
    });
  });

  describe('CORS', () => {
    it('should handle preflight requests', async () => {
      const request = new Request('https://example.com/api/workspaces', {
        method: 'OPTIONS',
      });

      const response = await handler(request, {} as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://contributor.info');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should include CORS headers in all responses', async () => {
      mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const request = new Request('https://example.com/api/workspaces', {
        method: 'GET',
      });

      const response = await handler(request, {} as any);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://contributor.info');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });
  });
});
