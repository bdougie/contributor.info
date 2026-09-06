import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueRefreshError, requestWorkspaceIssuesRefresh } from '../github-issue-refresh';

const invoke = vi.fn();
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: vi.fn(() => Promise.resolve({ functions: { invoke } })),
}));

describe('requestWorkspaceIssuesRefresh', () => {
  beforeEach(() => invoke.mockReset());

  it('sends the workspace, repositories, and GitHub token to the refresh function', async () => {
    const payload = {
      success: true,
      refreshedAt: '2026-09-05T00:00:00Z',
      windowDays: 30,
      results: [],
    };
    invoke.mockResolvedValue({ data: payload, error: null });

    const response = await requestWorkspaceIssuesRefresh({
      workspaceId: 'ws-1',
      repositoryIds: ['repo-a'],
      githubToken: 'gh-token',
    });

    expect(response).toEqual(payload);
    expect(invoke).toHaveBeenCalledWith('workspace-issues-refresh', {
      body: { workspaceId: 'ws-1', repositoryIds: ['repo-a'], github_token: 'gh-token' },
    });
  });

  it('maps an expired session to a sign-in message', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 401,
          json: () => Promise.resolve({ error: 'Invalid or expired token' }),
        },
      },
    });

    await expect(
      requestWorkspaceIssuesRefresh({ workspaceId: 'ws-1', repositoryIds: ['repo-a'] })
    ).rejects.toMatchObject({ name: 'IssueRefreshError', status: 401 });
  });

  it('surfaces the server message for membership and rate-limit rejections', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 403,
          json: () => Promise.resolve({ error: 'You are not a member of this workspace.' }),
        },
      },
    });

    await expect(
      requestWorkspaceIssuesRefresh({ workspaceId: 'ws-1', repositoryIds: ['repo-a'] })
    ).rejects.toThrow('You are not a member of this workspace.');
  });

  it('reports an unreachable service without a status', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'Failed to fetch' } });

    const failure = await requestWorkspaceIssuesRefresh({
      workspaceId: 'ws-1',
      repositoryIds: ['repo-a'],
    }).catch((error: IssueRefreshError) => error);

    expect(failure).toBeInstanceOf(IssueRefreshError);
    expect(failure.status).toBeUndefined();
    expect(failure.message).toMatch(/Could not reach the refresh service/);
  });

  it('rejects a malformed function response', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });
    await expect(
      requestWorkspaceIssuesRefresh({ workspaceId: 'ws-1', repositoryIds: ['repo-a'] })
    ).rejects.toThrow('unexpected response');
  });
});
