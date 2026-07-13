import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceService } from '../workspace.service';
import { supabase } from '@/lib/supabase';
import { getSupabase } from '@/lib/supabase-lazy';
import { inngest } from '@/lib/inngest/client';
import { workspacePrioritySync } from '@/lib/progressive-capture/workspace-priority-sync';
import type { MockQueryBuilder } from './test-types';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('@/lib/progressive-capture/workspace-priority-sync', () => ({
  workspacePrioritySync: {
    markAsWorkspaceRepo: vi.fn().mockResolvedValue(undefined),
  },
  WorkspacePrioritySync: vi.fn(),
}));

vi.mock('@/lib/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['mock-event-id'] }),
  },
}));

vi.mock('@/lib/error-logging', () => ({
  logError: vi.fn(),
}));

const WORKSPACE_ID = 'workspace-1';
const USER_ID = 'user-1';
const REPO_A = '11111111-1111-4111-8111-111111111111';
const REPO_B = '22222222-2222-4222-8222-222222222222';

/**
 * Build a supabase.from mock for the bulk-add happy path / limit path.
 * Tables hit in order:
 *  1. workspace_repositories.select('repository_id').eq().in()  -> existing rows
 *  2. workspaces.select('max_repositories').eq().maybeSingle()  -> workspace
 *  3. workspace_repositories.select(count head).eq()            -> current count
 *  4. workspace_repositories.insert([...])                      -> insert
 *  5. workspace_repositories.select(count head).eq()            -> new count
 *  6. workspaces.update().eq()                                  -> counter resync
 *  7. repositories.select('full_name').eq().maybeSingle()       -> event name
 */
function setupFromMock(opts: {
  existingRepoIds: string[];
  maxRepositories: number;
  currentCount: number;
  insertError?: { message: string } | null;
  /** Row returned by workspaces.maybeSingle(); pass null to simulate a missing workspace. */
  workspaceRow?: { max_repositories: number } | null;
}) {
  const workspaceRow =
    opts.workspaceRow === undefined
      ? { max_repositories: opts.maxRepositories }
      : opts.workspaceRow;
  const insertMock = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  let workspaceRepoSelectCalls = 0;

  vi.mocked(supabase.from).mockImplementation((table: string): MockQueryBuilder => {
    if (table === 'workspace_repositories') {
      return {
        select: vi.fn().mockImplementation(() => {
          workspaceRepoSelectCalls++;
          if (workspaceRepoSelectCalls === 1) {
            // duplicate check: .eq().in()
            return {
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: opts.existingRepoIds.map((id) => ({ repository_id: id })),
                  error: null,
                }),
              }),
            };
          }
          // count checks: .eq() resolves with { count }
          return {
            eq: vi.fn().mockResolvedValue({
              count: opts.currentCount,
              error: null,
            }),
          };
        }),
        insert: insertMock,
      } as MockQueryBuilder;
    }
    if (table === 'workspaces') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: workspaceRow,
              error: null,
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      } as MockQueryBuilder;
    }
    if (table === 'repositories') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { full_name: 'acme/widgets' },
              error: null,
            }),
          }),
        }),
      } as MockQueryBuilder;
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { insertMock };
}

describe('WorkspaceService.addRepositoriesToWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSupabase).mockResolvedValue(supabase);
    vi.spyOn(WorkspaceService, 'checkPermission').mockResolvedValue({
      hasPermission: true,
      role: 'owner',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an empty repository list', async () => {
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, []);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
  });

  it('rejects when the user lacks permission', async () => {
    vi.spyOn(WorkspaceService, 'checkPermission').mockResolvedValue({ hasPermission: false });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
    ]);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
  });

  it('skips repositories already in the workspace without inserting', async () => {
    const { insertMock } = setupFromMock({
      existingRepoIds: [REPO_A],
      maxRepositories: 10,
      currentCount: 1,
    });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
    ]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ added: [], skipped: [REPO_A] });
    expect(insertMock).not.toHaveBeenCalled();
    expect(vi.mocked(inngest.send)).not.toHaveBeenCalled();
  });

  it('rejects when the batch would exceed the workspace limit', async () => {
    setupFromMock({ existingRepoIds: [], maxRepositories: 3, currentCount: 2 });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
      REPO_B,
    ]);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.error).toContain('limit');
  });

  it('rejects with 404 when the workspace is not found', async () => {
    const { insertMock } = setupFromMock({
      existingRepoIds: [],
      maxRepositories: 10,
      currentCount: 0,
      workspaceRow: null,
    });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
    ]);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.error).toBe('Workspace not found');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('returns 500 and sends no events when the insert fails', async () => {
    const { insertMock } = setupFromMock({
      existingRepoIds: [],
      maxRepositories: 10,
      currentCount: 0,
      insertError: { message: 'insert failed' },
    });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
    ]);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(inngest.send)).not.toHaveBeenCalled();
  });

  it('inserts new repositories in one batch and fires one event of each type', async () => {
    const { insertMock } = setupFromMock({
      existingRepoIds: [REPO_A],
      maxRepositories: 10,
      currentCount: 1,
    });
    const result = await WorkspaceService.addRepositoriesToWorkspace(WORKSPACE_ID, USER_ID, [
      REPO_A,
      REPO_B,
    ]);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ added: [REPO_B], skipped: [REPO_A] });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith([
      {
        workspace_id: WORKSPACE_ID,
        repository_id: REPO_B,
        added_by: USER_ID,
        notes: null,
        tags: [],
        is_pinned: false,
      },
    ]);
    expect(vi.mocked(workspacePrioritySync.markAsWorkspaceRepo)).toHaveBeenCalledWith(REPO_B);
    const eventNames = vi.mocked(inngest.send).mock.calls.map((call) => {
      const payload = call[0] as { name: string };
      return payload.name;
    });
    expect(eventNames).toEqual(['workspace/priorities.sync', 'workspace.repository.changed']);
  });
});
