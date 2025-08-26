import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleIssueCommentEvent,
  containsIssuesCommand,
} from '../../../../app/webhooks/issue-comment';
import type { IssueCommentEvent } from '../../../../app/types/github';

// Mock the auth module
vi.mock('../../../../app/lib/auth', () => ({
  githubAppAuth: {
    getInstallationOctokit: vi.fn(() => ({
      issues: {
        createComment: vi.fn().mockResolvedValue({ _data: { id: 12345 } }),
        deleteComment: vi.fn().mockResolvedValue({}),
      },
      pulls: {
        listFiles: vi.fn().mockResolvedValue({
          data: [{ filename: 'src/auth.js' }, { filename: 'src/utils.js' }],
        }),
      },
    })),
  },
}));

// Mock supabase
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const chainObj = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ _data: { id: 'test-id' } }),
        upsert: vi.fn().mockReturnThis(),
      };

      // Special handling for different tables
      if (table === 'pull_requests') {
        chainObj.single = vi.fn().mockResolvedValue({ _data: { id: 'pr-123', repository_id: 1 } });
      } else if (table === 'comment_commands') {
        chainObj.single = vi.fn().mockResolvedValue({ _data: { id: 'cmd-123' } });
      } else if (table === 'contributors') {
        chainObj.single = vi.fn().mockResolvedValue({ _data: { id: 'contributor-123' } });
      }

      return chainObj;
    }),
  },
}));

// Mock services
vi.mock('../../../../app/services/issue-context', () => ({
  findContextualIssues: vi.fn().mockResolvedValue([
    {
      id: '1',
      type: 'issue',
      number: 123,
      title: 'Test issue',
      state: 'open',
      similarity_score: 0.85,
      file_overlap_score: 0.6,
      relationship: 'may_fix',
      reasons: ['High similarity'],
      created_at: '2024-01-01',
    },
  ]),
}));

vi.mock('../../../../app/services/comments', () => ({
  formatContextComment: vi.fn().mockReturnValue('## Context Analysis\nTest response'),
}));

describe('containsIssuesCommand', () => {
  it('detects .issues command correctly', () => {
    expect(containsIssuesCommand('.issues')).toBe(true);
    expect(containsIssuesCommand('Hello\n.issues')).toBe(true);
    expect(containsIssuesCommand('Run .issues command')).toBe(false);
    expect(containsIssuesCommand('')).toBe(false);
  });
});

describe('handleIssueCommentEvent', () => {
  const createMockEvent = (commentBody: string, isPR: boolean = true): IssueCommentEvent => ({
    action: 'created',
    issue: {
      id: 1,
      number: 42,
      title: 'Test PR',
      body: 'Test body',
      state: 'open',
      pull_request: isPR ? { url: 'test', html_url: 'test' } : undefined,
    },
    comment: {
      id: 999,
      body: commentBody,
      user: { id: 1, login: 'testuser' },
    },
    repository: {
      id: 1,
      full_name: 'test/repo',
      owner: { login: 'test' },
      name: 'repo',
    },
    installation: { id: 123 },
    sender: {},
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores non-.issues comments', async () => {
    const mockEvent = createMockEvent('Just a regular comment');
    const { githubAppAuth } = await import('../../../../app/lib/auth');
    const mockOctokit = await githubAppAuth.getInstallationOctokit(123);

    await handleIssueCommentEvent(mockEvent);

    expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    expect(mockOctokit.issues.deleteComment).not.toHaveBeenCalled();
  });

  it('ignores comments on issues (not PRs)', async () => {
    const mockEvent = createMockEvent('.issues', false);
    const { githubAppAuth } = await import('../../../../app/lib/auth');
    const mockOctokit = await githubAppAuth.getInstallationOctokit(123);

    await handleIssueCommentEvent(mockEvent);

    expect(mockOctokit.issues.createComment).not.toHaveBeenCalled();
    expect(mockOctokit.issues.deleteComment).not.toHaveBeenCalled();
  });
});
