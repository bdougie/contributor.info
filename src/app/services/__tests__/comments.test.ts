import { describe, it, expect, vi } from 'vitest';
import { formatPRComment, formatMinimalPRComment, formatWelcomeComment, formatErrorComment, formatContextComment } from '../../../../app/services/comments';
import { PullRequest, Repository, Issue } from '../../../../app/types/github';
import { ContributorInsights } from '../../../../app/services/insights';
import { SimilarIssue } from '../../../../app/services/similarity';
import { ReviewerSuggestion } from '../../../../app/services/reviewers';
import { ContextualItem } from '../../../../app/services/issue-context';
import { ContributorConfig } from '../../../../app/services/contributor-config';

describe('Comments Service', () => {
  // Mock data
  const mockRepository: Repository = {
    id: 123,
    name: 'test-repo',
    full_name: 'test-org/test-repo',
    owner: {
      login: 'test-org',
      id: 456,
      type: 'Organization',
    },
    private: false,
    description: 'Test repository',
    fork: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    pushed_at: '2024-01-01T00:00:00Z',
    homepage: null,
    size: 100,
    stargazers_count: 10,
    watchers_count: 10,
    language: 'TypeScript',
    forks_count: 5,
    open_issues_count: 3,
    default_branch: 'main',
    topics: [],
    archived: false,
    disabled: false,
    visibility: 'public',
  };

  const mockPullRequest: PullRequest = {
    id: 789,
    number: 42,
    state: 'open',
    title: 'Test PR',
    user: {
      login: 'testuser',
      id: 111,
      type: 'User',
    },
    body: 'Test PR body',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    closed_at: null,
    merged_at: null,
    merge_commit_sha: null,
    assignee: null,
    assignees: [],
    requested_reviewers: [],
    requested_teams: [],
    labels: [],
    milestone: null,
    draft: false,
    commits_url: '',
    review_comments_url: '',
    review_comment_url: '',
    comments_url: '',
    statuses_url: '',
    head: {
      label: 'test-org:feature-branch',
      ref: 'feature-branch',
      sha: 'abc123',
      user: {
        login: 'testuser',
        id: 111,
        type: 'User',
      },
      repo: mockRepository,
    },
    base: {
      label: 'test-org:main',
      ref: 'main',
      sha: 'def456',
      user: {
        login: 'test-org',
        id: 456,
        type: 'Organization',
      },
      repo: mockRepository,
    },
    _links: {
      self: { href: '' },
      html: { href: '' },
      issue: { href: '' },
      comments: { href: '' },
      review_comments: { href: '' },
      review_comment: { href: '' },
      commits: { href: '' },
      statuses: { href: '' },
    },
    author_association: 'CONTRIBUTOR',
    auto_merge: null,
    active_lock_reason: null,
    merged: false,
    mergeable: true,
    rebaseable: true,
    mergeable_state: 'clean',
    merged_by: null,
    comments: 0,
    review_comments: 0,
    maintainer_can_modify: false,
    commits: 1,
    additions: 10,
    deletions: 5,
    changed_files: 2,
  };

  const mockContributorInsights: ContributorInsights = {
    login: 'testuser',
    totalPRs: 10,
    mergedPRs: 8,
    reviewsGiven: 15,
    commentsLeft: 25,
    firstTimeApprovalRate: 75,
    expertise: ['frontend', 'testing'],
    activeHours: '9 AM - 5 PM UTC',
    lastActive: '2 hours ago',
    responseTime: '4 hours',
  };

  const mockReviewerSuggestions: ReviewerSuggestion[] = [
    {
      login: 'reviewer1',
      name: 'Reviewer One',
      avatarUrl: 'https://github.com/reviewer1.png',
      score: 0.8,
      reasons: ['Code ownership', 'Domain expertise'],
      stats: {
        reviewsGiven: 50,
        avgResponseTime: '4 hours',
        expertise: ['backend', 'api'],
        lastActive: '1 hour ago',
      },
    },
    {
      login: 'reviewer2',
      name: 'Reviewer Two',
      avatarUrl: 'https://github.com/reviewer2.png',
      score: 0.6,
      reasons: ['Frequent reviewer'],
      stats: {
        reviewsGiven: 30,
        avgResponseTime: '1 day',
        expertise: ['frontend'],
        lastActive: '3 hours ago',
      },
    },
  ];

  const mockSimilarIssues: SimilarIssue[] = [
    {
      issue: {
        id: 101,
        number: 10,
        state: 'open',
        title: 'Fix login bug',
        user: { login: 'user1', id: 201, type: 'User' },
        labels: [],
        assignee: null,
        assignees: [],
        milestone: null,
        comments: 5,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        closed_at: null,
        author_association: 'CONTRIBUTOR',
        active_lock_reason: null,
        body: 'Login is broken',
        reactions: {
          url: '',
          total_count: 0,
          '+1': 0,
          '-1': 0,
          laugh: 0,
          hooray: 0,
          confused: 0,
          heart: 0,
          rocket: 0,
          eyes: 0,
        },
        timeline_url: '',
        performed_via_github_app: null,
        state_reason: null,
        html_url: 'https://github.com/test-org/test-repo/issues/10',
      },
      similarity: 0.9,
      relationship: 'fixes',
    },
    {
      issue: {
        id: 102,
        number: 11,
        state: 'open',
        title: 'Related UI improvement',
        user: { login: 'user2', id: 202, type: 'User' },
        labels: [],
        assignee: null,
        assignees: [],
        milestone: null,
        comments: 2,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        closed_at: null,
        author_association: 'CONTRIBUTOR',
        active_lock_reason: null,
        body: 'UI needs improvement',
        reactions: {
          url: '',
          total_count: 0,
          '+1': 0,
          '-1': 0,
          laugh: 0,
          hooray: 0,
          confused: 0,
          heart: 0,
          rocket: 0,
          eyes: 0,
        },
        timeline_url: '',
        performed_via_github_app: null,
        state_reason: null,
        html_url: 'https://github.com/test-org/test-repo/issues/11',
      },
      similarity: 0.7,
      relationship: 'relates_to',
    },
  ];

  describe('formatUsername', () => {
    it('should format username as @mention when github_mentions is enabled', () => {
      const config: ContributorConfig = {
        version: 1,
        features: {
          github_mentions: true,
        },
      };

      const comment = formatPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: mockReviewerSuggestions,
        config,
      });

      // Check that reviewers are formatted with @ mentions
      expect(comment).toContain('**@reviewer1**');
      expect(comment).toContain('**@reviewer2**');
      expect(comment).not.toContain('[reviewer1](https://github.com/reviewer1)');
      expect(comment).not.toContain('[reviewer2](https://github.com/reviewer2)');
    });

    it('should format username as markdown link when github_mentions is disabled', () => {
      const config: ContributorConfig = {
        version: 1,
        features: {
          github_mentions: false,
        },
      };

      const comment = formatPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: mockReviewerSuggestions,
        config,
      });

      // Check that reviewers are formatted as markdown links
      expect(comment).toContain('**[reviewer1](https://github.com/reviewer1)**');
      expect(comment).toContain('**[reviewer2](https://github.com/reviewer2)**');
      expect(comment).not.toContain('@reviewer1');
      expect(comment).not.toContain('@reviewer2');
    });

    it('should default to markdown links when github_mentions is not specified', () => {
      const config: ContributorConfig = {
        version: 1,
        features: {},
      };

      const comment = formatPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: mockReviewerSuggestions,
        config,
      });

      // Default behavior should be markdown links
      expect(comment).toContain('**[reviewer1](https://github.com/reviewer1)**');
      expect(comment).toContain('**[reviewer2](https://github.com/reviewer2)**');
    });

    it('should sanitize usernames to prevent markdown injection', () => {
      const maliciousReviewers: ReviewerSuggestion[] = [
        {
          login: 'user[bot]',
          name: 'Malicious User',
          avatarUrl: 'https://github.com/user.png',
          score: 0.8,
          reasons: ['Test'],
          stats: {
            reviewsGiven: 10,
            avgResponseTime: '1 hour',
            expertise: ['test'],
            lastActive: '1 hour ago',
          },
        },
        {
          login: 'user(test)',
          name: 'Another User',
          avatarUrl: 'https://github.com/user2.png',
          score: 0.7,
          reasons: ['Test'],
          stats: {
            reviewsGiven: 5,
            avgResponseTime: '2 hours',
            expertise: ['test'],
            lastActive: '2 hours ago',
          },
        },
      ];

      const config: ContributorConfig = {
        version: 1,
        features: {
          github_mentions: true,
        },
      };

      const comment = formatPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: maliciousReviewers,
        config,
      });

      // Check that brackets and parentheses are removed
      expect(comment).toContain('@userbot');
      expect(comment).toContain('@usertest');
      expect(comment).not.toContain('[bot]');
      expect(comment).not.toContain('(test)');
    });

    it('should handle empty username gracefully', () => {
      const invalidReviewers: ReviewerSuggestion[] = [
        {
          login: '',
          name: 'Invalid User',
          avatarUrl: '',
          score: 0.5,
          reasons: ['Test'],
          stats: {
            reviewsGiven: 0,
            avgResponseTime: 'Unknown',
            expertise: [],
            lastActive: 'Unknown',
          },
        },
      ];

      const config: ContributorConfig = {
        version: 1,
        features: {
          github_mentions: true,
        },
      };

      // This should throw an error
      expect(() => {
        formatPRComment({
          pullRequest: mockPullRequest,
          repository: mockRepository,
          contributorInsights: mockContributorInsights,
          similarIssues: [],
          reviewerSuggestions: invalidReviewers,
          config,
        });
      }).toThrow('Invalid username provided');
    });
  });

  describe('formatMinimalPRComment', () => {
    it('should format usernames correctly in minimal mode with mentions enabled', () => {
      const config: ContributorConfig = {
        version: 1,
        features: {
          github_mentions: true,
        },
        comment_style: 'minimal',
      };

      const comment = formatMinimalPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: mockSimilarIssues,
        reviewerSuggestions: mockReviewerSuggestions,
        config,
      });

      // Check contributor username
      expect(comment).toContain('**@testuser**: 8/10 PRs merged');
      
      // Check reviewer suggestions
      expect(comment).toContain('Suggested reviewers: @reviewer1, @reviewer2');
    });

    it('should format usernames as links in minimal mode with mentions disabled', () => {
      const config: ContributorConfig = {
        version: 1,
        features: {
          github_mentions: false,
        },
        comment_style: 'minimal',
      };

      const comment = formatMinimalPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: mockSimilarIssues,
        reviewerSuggestions: mockReviewerSuggestions,
        config,
      });

      // Check contributor username
      expect(comment).toContain('**[testuser](https://github.com/testuser)**: 8/10 PRs merged');
      
      // Check reviewer suggestions
      expect(comment).toContain('Suggested reviewers: [reviewer1](https://github.com/reviewer1), [reviewer2](https://github.com/reviewer2)');
    });
  });

  describe('footer links', () => {
    it('should include repository-specific dashboard link in detailed comment', () => {
      const comment = formatPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: [],
      });

      expect(comment).toContain('https://contributor.info/test-org/test-repo');
      expect(comment).toContain('[contributor.info](https://contributor.info/test-org/test-repo)');
    });

    it('should include repository-specific dashboard link in minimal comment', () => {
      const comment = formatMinimalPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: [],
      });

      expect(comment).toContain('https://contributor.info/test-org/test-repo');
      expect(comment).toContain('[Details](https://contributor.info/test-org/test-repo)');
    });

    it('should include repository-specific dashboard link in welcome comment', () => {
      const comment = formatWelcomeComment('newuser', mockRepository);

      expect(comment).toContain('https://contributor.info/test-org/test-repo');
      expect(comment).toContain('[contributor.info](https://contributor.info/test-org/test-repo)');
    });

    it('should include repository-specific dashboard link in error comment', () => {
      const comment = formatErrorComment(mockRepository);

      expect(comment).toContain('https://contributor.info/test-org/test-repo');
      expect(comment).toContain('[contributor.info](https://contributor.info/test-org/test-repo)');
    });

    it('should handle missing repository in error comment', () => {
      const comment = formatErrorComment();

      expect(comment).toContain('https://contributor.info');
      expect(comment).toContain('[contributor.info](https://contributor.info)');
      expect(comment).not.toContain('test-org/test-repo');
    });
  });

  describe('integration with all comment types', () => {
    it('should consistently apply github_mentions setting across all comment functions', () => {
      const config: ContributorConfig = {
        version: 1,
        features: {
          github_mentions: true,
        },
      };

      // Test detailed comment
      const detailedComment = formatPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: mockReviewerSuggestions,
        config,
      });
      expect(detailedComment).toContain('@reviewer1');
      expect(detailedComment).toContain('@reviewer2');

      // Test minimal comment
      const minimalComment = formatMinimalPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: mockReviewerSuggestions,
        config,
      });
      expect(minimalComment).toContain('@testuser');
      expect(minimalComment).toContain('@reviewer1');

      // Test welcome comment (always uses @mention for new contributors)
      const welcomeComment = formatWelcomeComment('newcontributor', mockRepository);
      expect(welcomeComment).toContain('@newcontributor');
    });

    it('should handle special characters in usernames consistently', () => {
      const specialReviewers: ReviewerSuggestion[] = [
        {
          login: 'user-name_123',
          name: 'User Name',
          avatarUrl: 'https://github.com/user-name_123.png',
          score: 0.8,
          reasons: ['Test'],
          stats: {
            reviewsGiven: 10,
            avgResponseTime: '1 hour',
            expertise: ['test'],
            lastActive: '1 hour ago',
          },
        },
        {
          login: 'another.user',
          name: 'Another User',
          avatarUrl: 'https://github.com/another.user.png',
          score: 0.7,
          reasons: ['Test'],
          stats: {
            reviewsGiven: 5,
            avgResponseTime: '2 hours',
            expertise: ['test'],
            lastActive: '2 hours ago',
          },
        },
      ];

      const config: ContributorConfig = {
        version: 1,
        features: {
          github_mentions: true,
        },
      };

      const comment = formatPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: specialReviewers,
        config,
      });

      // Valid GitHub usernames with hyphens, underscores, and dots should work
      expect(comment).toContain('@user-name_123');
      expect(comment).toContain('@another.user');
    });

    it('should handle missing config gracefully', () => {
      const comment = formatPRComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contributorInsights: mockContributorInsights,
        similarIssues: [],
        reviewerSuggestions: mockReviewerSuggestions,
        // config is optional, should default to markdown links
      });

      // Should default to markdown links when config is not provided
      expect(comment).toContain('[reviewer1](https://github.com/reviewer1)');
      expect(comment).toContain('[reviewer2](https://github.com/reviewer2)');
      expect(comment).not.toContain('@reviewer1');
      expect(comment).not.toContain('@reviewer2');
    });
  });

  describe('formatContextComment', () => {
    const mockContextualItems: ContextualItem[] = [
      {
        number: 20,
        title: 'May fix this issue',
        type: 'issue',
        state: 'open',
        relationship: 'may_fix',
        similarity_score: 0.8,
        file_overlap_score: 0.9,
        reasons: ['Similar file changes', 'Related functionality'],
      },
      {
        number: 21,
        title: 'Related work',
        type: 'pull_request',
        state: 'closed',
        relationship: 'related_work',
        similarity_score: 0.7,
        file_overlap_score: 0.6,
        reasons: ['Similar approach'],
      },
    ];

    it('should format context comment with repository-specific link', () => {
      const comment = formatContextComment({
        pullRequest: mockPullRequest,
        repository: mockRepository,
        contextualItems: mockContextualItems,
        changedFiles: ['src/auth.ts', 'src/login.ts'],
      });

      expect(comment).toContain('https://contributor.info/test-org/test-repo');
      expect(comment).toContain('[contributor.info](https://contributor.info/test-org/test-repo)');
      expect(comment).toContain('📋 Issue Context Analysis');
      expect(comment).toContain('May Fix These Issues');
      expect(comment).toContain('#20');
    });
  });
});