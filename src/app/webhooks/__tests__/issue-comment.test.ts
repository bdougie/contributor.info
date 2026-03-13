import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleIssueCommentEvent,
  containsIssuesCommand,
} from '../../../../app/webhooks/issue-comment';
import type { IssueCommentEvent } from '../../../../app/types/github';

const { mockCreateComment, mockDeleteComment, mockListFiles } = vi.hoisted(() => ({
  mockCreateComment: vi.fn().mockResolvedValue({ data: { id: 12345 } }),
  mockDeleteComment: vi.fn().mockResolvedValue({}),
  mockListFiles: vi.fn().mockResolvedValue({
    data: [{ filename: 'src/auth.js' }, { filename: 'src/utils.js' }],
  }),
}));

// Mock the auth module
vi.mock('../../../../app/lib/auth', () => ({
  githubAppAuth: {
    getInstallationOctokit: vi.fn(() => ({
      issues: {
        createComment: mockCreateComment,
        deleteComment: mockDeleteComment,
      },
      pulls: {
        listFiles: mockListFiles,
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
        single: vi.fn().mockResolvedValue({ data: { id: 'test-id' } }),
        upsert: vi.fn().mockReturnThis(),
      };

      // Special handling for different tables
      if (table === 'pull_requests') {
        chainObj.single = vi.fn().mockResolvedValue({ data: { id: 'pr-123', repository_id: 1 } });
      } else if (table === 'comment_commands') {
        chainObj.single = vi.fn().mockResolvedValue({ data: { id: 'cmd-123' } });
      } else if (table === 'contributors') {
        chainObj.single = vi.fn().mockResolvedValue({ data: { id: 'contributor-123' } });
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

const mockUser = {
  login: 'testuser',
  id: 1,
  node_id: 'U_1',
  avatar_url: 'https://example.com/avatar',
  html_url: 'https://github.com/testuser',
  type: 'User' as const,
};

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
      node_id: 'I_1',
      url: 'https://api.github.com/repos/test/repo/issues/42',
      html_url: 'https://github.com/test/repo/pull/42',
      number: 42,
      title: 'Test PR',
      body: 'Test body',
      state: 'open',
      user: mockUser,
      labels: [],
      assignee: null,
      assignees: [],
      comments: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      closed_at: null,
      author_association: 'CONTRIBUTOR',
      pull_request: isPR ? { url: 'test', html_url: 'test' } : undefined,
    },
    comment: {
      id: 999,
      node_id: 'IC_999',
      url: 'https://api.github.com/repos/test/repo/issues/comments/999',
      html_url: 'https://github.com/test/repo/pull/42#issuecomment-999',
      body: commentBody,
      user: mockUser,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      author_association: 'CONTRIBUTOR',
    },
    repository: {
      id: 1,
      node_id: 'R_1',
      name: 'repo',
      full_name: 'test/repo',
      private: false,
      owner: { login: 'test', id: 1, type: 'Organization' },
      html_url: 'https://github.com/test/repo',
      description: null,
      fork: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      pushed_at: '2024-01-01T00:00:00Z',
      size: 0,
      stargazers_count: 0,
      language: 'TypeScript',
      default_branch: 'main',
    },
    installation: {
      id: 123,
      account: { login: 'test', id: 1, type: 'Organization' },
      repository_selection: 'selected',
      access_tokens_url: 'https://api.github.com/installations/123/access_tokens',
      repositories_url: 'https://api.github.com/installations/123/repositories',
      html_url: 'https://github.com/settings/installations/123',
      app_id: 1,
      app_slug: 'test-app',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      suspended_by: null,
      suspended_at: null,
    },
    sender: mockUser,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores non-.issues comments', () => {
    const mockEvent = createMockEvent('Just a regular comment');

    handleIssueCommentEvent(mockEvent);

    expect(mockCreateComment).not.toHaveBeenCalled();
    expect(mockDeleteComment).not.toHaveBeenCalled();
  });

  it('ignores comments on issues (not PRs)', () => {
    const mockEvent = createMockEvent('.issues', false);

    handleIssueCommentEvent(mockEvent);

    expect(mockCreateComment).not.toHaveBeenCalled();
    expect(mockDeleteComment).not.toHaveBeenCalled();
  });
});
