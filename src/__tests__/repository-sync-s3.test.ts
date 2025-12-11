import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { processSyncRequest } from '../../supabase/functions/repository-sync-s3/sync-logic';
import {
  FileSystem,
  Logger,
  SyncDependencies,
  SupabaseClientLike,
} from '../../supabase/functions/repository-sync-s3/types';

describe('repository-sync-s3 logic', () => {
  let mockSupabase: { from: Mock };
  let mockFileSystem: FileSystem;
  let mockLogger: Logger;
  let mockFetch: Mock;
  let mockEnsureContributor: Mock;
  let deps: SyncDependencies;

  const mockRepo = {
    id: 'repo-123',
    github_id: 1001,
    full_name: 'test/repo',
    is_tracked: true,
  };

  const mockPR = {
    id: 1,
    number: 101,
    title: 'Test PR',
    body: 'body',
    state: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    closed_at: null,
    merged_at: null,
    merge_commit_sha: null,
    user: { id: 1, login: 'user1' },
    base: { ref: 'main' },
    head: { ref: 'feat' },
  };

  beforeEach(() => {
    // Mock Supabase
    const singleMock = vi.fn().mockResolvedValue({ data: mockRepo, error: null });
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockResolvedValue({ error: null });

    mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'repositories') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: singleMock,
                }),
              }),
            }),
            update: () => ({
              eq: updateMock,
            }),
          };
        }
        if (table === 'pull_requests') {
          return {
            upsert: upsertMock,
          };
        }
        return {};
      }),
    };

    // Mock FileSystem
    const files: Record<string, string> = {};
    mockFileSystem = {
      writeTextFile: vi.fn().mockImplementation(async (path, content, options) => {
        if (options?.append) {
          files[path] = (files[path] || '') + content;
        } else {
          files[path] = content;
        }
      }),
      readTextFile: vi.fn().mockImplementation(async (path) => files[path]),
      exists: vi.fn().mockImplementation(async (path) => path in files),
      remove: vi.fn().mockImplementation(async (path) => {
        delete files[path];
      }),
      ensureDir: vi.fn().mockResolvedValue(undefined),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [mockPR],
    });

    mockEnsureContributor = vi.fn().mockResolvedValue('contributor-123');

    deps = {
      supabase: mockSupabase as unknown as SupabaseClientLike,
      fileSystem: mockFileSystem,
      logger: mockLogger,
      githubToken: 'fake-token',
      fetch: mockFetch,
      ensureContributor: mockEnsureContributor,
      env: {
        get: vi.fn().mockReturnValue('50'),
      },
    };
  });

  it('should sync repository successfully using file storage', async () => {
    const request = {
      owner: 'test',
      name: 'repo',
      fullSync: false,
    };

    const result = await processSyncRequest(request, deps);

    expect(result.status).toBe(200);

    // Check flow
    // 1. Fetch
    expect(mockFetch).toHaveBeenCalled();

    // 2. Write to file
    expect(mockFileSystem.writeTextFile).toHaveBeenCalled();
    const writeCall = vi.mocked(mockFileSystem.writeTextFile).mock.calls[0];
    expect(writeCall[0]).toContain('/s3/temp/');

    // 3. Read from file
    expect(mockFileSystem.readTextFile).toHaveBeenCalled();

    // 4. Process (upsert)
    // The upsert logic in sync-logic calls: deps.supabase.from('pull_requests').upsert(...)
    expect(mockSupabase.from).toHaveBeenCalledWith('pull_requests');

    // 5. Cleanup
    expect(mockFileSystem.remove).toHaveBeenCalled();
  });
});
