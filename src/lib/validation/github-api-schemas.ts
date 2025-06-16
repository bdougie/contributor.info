/**
 * Zod validation schemas for GitHub API responses
 * These schemas validate data coming from the GitHub API before processing
 * and ensure type safety for all external data inputs.
 */

import { z } from 'zod';

// =====================================================
// GITHUB API BASE SCHEMAS
// =====================================================

/**
 * GitHub user schema (for user objects in API responses)
 */
export const githubUserSchema = z.object({
  id: z.number().int().positive('GitHub user ID must be positive'),
  login: z.string().min(1, 'GitHub username cannot be empty').max(39, 'GitHub username too long'),
  avatar_url: z.string().url('Invalid avatar URL'),
  gravatar_id: z.string().nullable().optional(),
  url: z.string().url('Invalid user URL'),
  html_url: z.string().url('Invalid HTML URL'),
  followers_url: z.string().url().optional(),
  following_url: z.string().url().optional(),
  gists_url: z.string().url().optional(),
  starred_url: z.string().url().optional(),
  subscriptions_url: z.string().url().optional(),
  organizations_url: z.string().url().optional(),
  repos_url: z.string().url().optional(),
  events_url: z.string().url().optional(),
  received_events_url: z.string().url().optional(),
  type: z.enum(['User', 'Bot'], {
    errorMap: () => ({ message: 'GitHub user type must be "User" or "Bot"' }),
  }),
  site_admin: z.boolean().optional(),
  name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  blog: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  hireable: z.boolean().nullable().optional(),
  bio: z.string().nullable().optional(),
  twitter_username: z.string().nullable().optional(),
  public_repos: z.number().int().min(0, 'Public repos count cannot be negative').optional(),
  public_gists: z.number().int().min(0, 'Public gists count cannot be negative').optional(),
  followers: z.number().int().min(0, 'Followers count cannot be negative').optional(),
  following: z.number().int().min(0, 'Following count cannot be negative').optional(),
  created_at: z.string().datetime('Invalid created_at timestamp').optional(),
  updated_at: z.string().datetime('Invalid updated_at timestamp').optional(),
});

/**
 * GitHub organization schema
 */
export const githubOrganizationSchema = z.object({
  id: z.number().int().positive('GitHub organization ID must be positive'),
  login: z.string().min(1, 'Organization login cannot be empty'),
  url: z.string().url('Invalid organization URL'),
  repos_url: z.string().url('Invalid repos URL'),
  events_url: z.string().url('Invalid events URL'),
  hooks_url: z.string().url('Invalid hooks URL'),
  issues_url: z.string().url('Invalid issues URL'),
  members_url: z.string().url('Invalid members URL'),
  public_members_url: z.string().url('Invalid public members URL'),
  avatar_url: z.string().url('Invalid avatar URL'),
  description: z.string().nullable(),
  name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  blog: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  twitter_username: z.string().nullable().optional(),
  html_url: z.string().url('Invalid HTML URL').optional(),
  created_at: z.string().datetime('Invalid created_at timestamp').optional(),
  updated_at: z.string().datetime('Invalid updated_at timestamp').optional(),
  type: z.literal('Organization').optional(),
  public_repos: z.number().int().min(0).optional(),
  public_gists: z.number().int().min(0).optional(),
  followers: z.number().int().min(0).optional(),
  following: z.number().int().min(0).optional(),
});

/**
 * GitHub repository schema
 */
export const githubRepositorySchema = z.object({
  id: z.number().int().positive('Repository ID must be positive'),
  node_id: z.string().optional(),
  name: z.string().min(1, 'Repository name cannot be empty'),
  full_name: z.string().regex(/^[^/]+\/[^/]+$/, 'Invalid repository full name format'),
  private: z.boolean(),
  owner: githubUserSchema,
  html_url: z.string().url('Invalid HTML URL'),
  description: z.string().nullable(),
  fork: z.boolean(),
  url: z.string().url('Invalid repository URL'),
  archive_url: z.string().url().optional(),
  assignees_url: z.string().url().optional(),
  blobs_url: z.string().url().optional(),
  branches_url: z.string().url().optional(),
  collaborators_url: z.string().url().optional(),
  comments_url: z.string().url().optional(),
  commits_url: z.string().url().optional(),
  compare_url: z.string().url().optional(),
  contents_url: z.string().url().optional(),
  contributors_url: z.string().url().optional(),
  deployments_url: z.string().url().optional(),
  downloads_url: z.string().url().optional(),
  events_url: z.string().url().optional(),
  forks_url: z.string().url().optional(),
  git_commits_url: z.string().url().optional(),
  git_refs_url: z.string().url().optional(),
  git_tags_url: z.string().url().optional(),
  git_url: z.string().optional(),
  issue_comment_url: z.string().url().optional(),
  issue_events_url: z.string().url().optional(),
  issues_url: z.string().url().optional(),
  keys_url: z.string().url().optional(),
  labels_url: z.string().url().optional(),
  languages_url: z.string().url().optional(),
  merges_url: z.string().url().optional(),
  milestones_url: z.string().url().optional(),
  notifications_url: z.string().url().optional(),
  pulls_url: z.string().url().optional(),
  releases_url: z.string().url().optional(),
  ssh_url: z.string().optional(),
  stargazers_url: z.string().url().optional(),
  statuses_url: z.string().url().optional(),
  subscribers_url: z.string().url().optional(),
  subscription_url: z.string().url().optional(),
  tags_url: z.string().url().optional(),
  teams_url: z.string().url().optional(),
  trees_url: z.string().url().optional(),
  clone_url: z.string().url().optional(),
  mirror_url: z.string().url().nullable().optional(),
  hooks_url: z.string().url().optional(),
  svn_url: z.string().url().optional(),
  homepage: z.string().nullable(),
  language: z.string().nullable(),
  forks_count: z.number().int().min(0, 'Forks count cannot be negative'),
  stargazers_count: z.number().int().min(0, 'Stargazers count cannot be negative'),
  watchers_count: z.number().int().min(0, 'Watchers count cannot be negative'),
  size: z.number().int().min(0, 'Repository size cannot be negative'),
  default_branch: z.string().min(1, 'Default branch cannot be empty'),
  open_issues_count: z.number().int().min(0, 'Open issues count cannot be negative'),
  is_template: z.boolean().optional(),
  topics: z.array(z.string()).optional(),
  has_issues: z.boolean(),
  has_projects: z.boolean(),
  has_wiki: z.boolean(),
  has_pages: z.boolean(),
  has_downloads: z.boolean(),
  archived: z.boolean(),
  disabled: z.boolean(),
  visibility: z.enum(['public', 'private', 'internal']).optional(),
  pushed_at: z.string().datetime('Invalid pushed_at timestamp').nullable(),
  created_at: z.string().datetime('Invalid created_at timestamp'),
  updated_at: z.string().datetime('Invalid updated_at timestamp'),
  permissions: z.object({
    admin: z.boolean(),
    push: z.boolean(),
    pull: z.boolean(),
  }).optional(),
  allow_rebase_merge: z.boolean().optional(),
  template_repository: z.object({}).nullable().optional(),
  temp_clone_token: z.string().optional(),
  allow_squash_merge: z.boolean().optional(),
  allow_auto_merge: z.boolean().optional(),
  delete_branch_on_merge: z.boolean().optional(),
  allow_merge_commit: z.boolean().optional(),
  subscribers_count: z.number().int().min(0).optional(),
  network_count: z.number().int().min(0).optional(),
  license: z.object({
    key: z.string(),
    name: z.string(),
    spdx_id: z.string().nullable(),
    url: z.string().url().nullable(),
    node_id: z.string(),
  }).nullable().optional(),
});

/**
 * GitHub pull request schema
 */
export const githubPullRequestSchema = z.object({
  id: z.number().int().positive('Pull request ID must be positive'),
  node_id: z.string().optional(),
  number: z.number().int().positive('Pull request number must be positive'),
  state: z.enum(['open', 'closed'], {
    errorMap: () => ({ message: 'Pull request state must be "open" or "closed"' }),
  }),
  locked: z.boolean().optional(),
  title: z.string().min(1, 'Pull request title cannot be empty'),
  user: githubUserSchema,
  body: z.string().nullable(),
  labels: z.array(z.object({
    id: z.number().int(),
    node_id: z.string(),
    url: z.string().url(),
    name: z.string(),
    description: z.string().nullable(),
    color: z.string(),
    default: z.boolean(),
  })).optional(),
  milestone: z.object({
    url: z.string().url(),
    html_url: z.string().url(),
    labels_url: z.string().url(),
    id: z.number().int(),
    node_id: z.string(),
    number: z.number().int(),
    state: z.enum(['open', 'closed']),
    title: z.string(),
    description: z.string().nullable(),
    creator: githubUserSchema,
    open_issues: z.number().int(),
    closed_issues: z.number().int(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    closed_at: z.string().datetime().nullable(),
    due_on: z.string().datetime().nullable(),
  }).nullable().optional(),
  active_lock_reason: z.string().nullable().optional(),
  created_at: z.string().datetime('Invalid created_at timestamp'),
  updated_at: z.string().datetime('Invalid updated_at timestamp'),
  closed_at: z.string().datetime('Invalid closed_at timestamp').nullable(),
  merged_at: z.string().datetime('Invalid merged_at timestamp').nullable(),
  merge_commit_sha: z.string().nullable(),
  assignee: githubUserSchema.nullable(),
  assignees: z.array(githubUserSchema).optional(),
  requested_reviewers: z.array(githubUserSchema).optional(),
  requested_teams: z.array(z.object({
    id: z.number().int(),
    node_id: z.string(),
    url: z.string().url(),
    html_url: z.string().url(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    privacy: z.enum(['open', 'closed', 'secret']),
    permission: z.string(),
    members_url: z.string().url(),
    repositories_url: z.string().url(),
  })).optional(),
  head: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
    user: githubUserSchema.nullable(),
    repo: githubRepositorySchema.nullable(),
  }),
  base: z.object({
    label: z.string(),
    ref: z.string(),
    sha: z.string(),
    user: githubUserSchema,
    repo: githubRepositorySchema,
  }),
  _links: z.object({
    self: z.object({ href: z.string().url() }),
    html: z.object({ href: z.string().url() }),
    issue: z.object({ href: z.string().url() }),
    comments: z.object({ href: z.string().url() }),
    review_comments: z.object({ href: z.string().url() }),
    review_comment: z.object({ href: z.string().url() }),
    commits: z.object({ href: z.string().url() }),
    statuses: z.object({ href: z.string().url() }),
  }).optional(),
  author_association: z.enum([
    'COLLABORATOR',
    'CONTRIBUTOR',
    'FIRST_TIMER',
    'FIRST_TIME_CONTRIBUTOR',
    'MANNEQUIN',
    'MEMBER',
    'NONE',
    'OWNER',
  ]).optional(),
  auto_merge: z.object({}).nullable().optional(),
  draft: z.boolean(),
  merged: z.boolean(),
  mergeable: z.boolean().nullable(),
  rebaseable: z.boolean().nullable().optional(),
  mergeable_state: z.string(),
  merged_by: githubUserSchema.nullable(),
  comments: z.number().int().min(0, 'Comments count cannot be negative'),
  review_comments: z.number().int().min(0, 'Review comments count cannot be negative'),
  maintainer_can_modify: z.boolean().optional(),
  commits: z.number().int().min(0, 'Commits count cannot be negative'),
  additions: z.number().int().min(0, 'Additions count cannot be negative'),
  deletions: z.number().int().min(0, 'Deletions count cannot be negative'),
  changed_files: z.number().int().min(0, 'Changed files count cannot be negative'),
  url: z.string().url('Invalid pull request URL').optional(),
  html_url: z.string().url('Invalid HTML URL').optional(),
  diff_url: z.string().url('Invalid diff URL').optional(),
  patch_url: z.string().url('Invalid patch URL').optional(),
  issue_url: z.string().url('Invalid issue URL').optional(),
  commits_url: z.string().url().optional(),
  review_comments_url: z.string().url().optional(),
  review_comment_url: z.string().url().optional(),
  comments_url: z.string().url().optional(),
  statuses_url: z.string().url().optional(),
});

/**
 * GitHub review schema
 */
export const githubReviewSchema = z.object({
  id: z.number().int().positive('Review ID must be positive'),
  node_id: z.string(),
  user: githubUserSchema,
  body: z.string().nullable(),
  state: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING'], {
    errorMap: () => ({ message: 'Invalid review state' }),
  }),
  html_url: z.string().url('Invalid HTML URL'),
  pull_request_url: z.string().url('Invalid pull request URL'),
  _links: z.object({
    html: z.object({ href: z.string().url() }),
    pull_request: z.object({ href: z.string().url() }),
  }),
  submitted_at: z.string().datetime('Invalid submitted_at timestamp').nullable(),
  commit_id: z.string(),
  author_association: z.enum([
    'COLLABORATOR',
    'CONTRIBUTOR',
    'FIRST_TIMER',
    'FIRST_TIME_CONTRIBUTOR',
    'MANNEQUIN',
    'MEMBER',
    'NONE',
    'OWNER',
  ]),
});

/**
 * GitHub comment schema (issue/PR comments)
 */
export const githubCommentSchema = z.object({
  id: z.number().int().positive('Comment ID must be positive'),
  node_id: z.string(),
  url: z.string().url('Invalid comment URL'),
  html_url: z.string().url('Invalid HTML URL'),
  body: z.string().min(1, 'Comment body cannot be empty'),
  user: githubUserSchema,
  created_at: z.string().datetime('Invalid created_at timestamp'),
  updated_at: z.string().datetime('Invalid updated_at timestamp'),
  issue_url: z.string().url('Invalid issue URL').optional(),
  author_association: z.enum([
    'COLLABORATOR',
    'CONTRIBUTOR',
    'FIRST_TIMER',
    'FIRST_TIME_CONTRIBUTOR',
    'MANNEQUIN',
    'MEMBER',
    'NONE',
    'OWNER',
  ]),
  reactions: z.object({
    url: z.string().url(),
    total_count: z.number().int().min(0),
    '+1': z.number().int().min(0),
    '-1': z.number().int().min(0),
    laugh: z.number().int().min(0),
    hooray: z.number().int().min(0),
    confused: z.number().int().min(0),
    heart: z.number().int().min(0),
    rocket: z.number().int().min(0),
    eyes: z.number().int().min(0),
  }).optional(),
});

/**
 * GitHub review comment schema (inline code comments)
 */
export const githubReviewCommentSchema = z.object({
  id: z.number().int().positive('Review comment ID must be positive'),
  node_id: z.string(),
  url: z.string().url('Invalid comment URL'),
  diff_hunk: z.string(),
  path: z.string(),
  position: z.number().int().nullable(),
  original_position: z.number().int(),
  commit_id: z.string(),
  original_commit_id: z.string(),
  in_reply_to_id: z.number().int().optional(),
  user: githubUserSchema,
  body: z.string().min(1, 'Comment body cannot be empty'),
  created_at: z.string().datetime('Invalid created_at timestamp'),
  updated_at: z.string().datetime('Invalid updated_at timestamp'),
  html_url: z.string().url('Invalid HTML URL'),
  pull_request_url: z.string().url('Invalid pull request URL'),
  author_association: z.enum([
    'COLLABORATOR',
    'CONTRIBUTOR',
    'FIRST_TIMER',
    'FIRST_TIME_CONTRIBUTOR',
    'MANNEQUIN',
    'MEMBER',
    'NONE',
    'OWNER',
  ]),
  _links: z.object({
    self: z.object({ href: z.string().url() }),
    html: z.object({ href: z.string().url() }),
    pull_request: z.object({ href: z.string().url() }),
  }),
  reactions: z.object({
    url: z.string().url(),
    total_count: z.number().int().min(0),
    '+1': z.number().int().min(0),
    '-1': z.number().int().min(0),
    laugh: z.number().int().min(0),
    hooray: z.number().int().min(0),
    confused: z.number().int().min(0),
    heart: z.number().int().min(0),
    rocket: z.number().int().min(0),
    eyes: z.number().int().min(0),
  }).optional(),
});

/**
 * GitHub commit schema
 */
export const githubCommitSchema = z.object({
  sha: z.string().length(40, 'Commit SHA must be 40 characters'),
  node_id: z.string(),
  commit: z.object({
    author: z.object({
      name: z.string(),
      email: z.string().email(),
      date: z.string().datetime(),
    }),
    committer: z.object({
      name: z.string(),
      email: z.string().email(),
      date: z.string().datetime(),
    }),
    message: z.string(),
    tree: z.object({
      sha: z.string().length(40),
      url: z.string().url(),
    }),
    url: z.string().url(),
    comment_count: z.number().int().min(0),
    verification: z.object({
      verified: z.boolean(),
      reason: z.string(),
      signature: z.string().nullable(),
      payload: z.string().nullable(),
    }).optional(),
  }),
  url: z.string().url(),
  html_url: z.string().url(),
  comments_url: z.string().url(),
  author: githubUserSchema.nullable(),
  committer: githubUserSchema.nullable(),
  parents: z.array(z.object({
    sha: z.string().length(40),
    url: z.string().url(),
    html_url: z.string().url(),
  })),
  stats: z.object({
    total: z.number().int().min(0),
    additions: z.number().int().min(0),
    deletions: z.number().int().min(0),
  }).optional(),
  files: z.array(z.object({
    sha: z.string().nullable(),
    filename: z.string(),
    status: z.enum(['added', 'removed', 'modified', 'renamed', 'copied', 'changed', 'unchanged']),
    additions: z.number().int().min(0),
    deletions: z.number().int().min(0),
    changes: z.number().int().min(0),
    blob_url: z.string().url(),
    raw_url: z.string().url(),
    contents_url: z.string().url(),
    patch: z.string().optional(),
    previous_filename: z.string().optional(),
  })).optional(),
});

// =====================================================
// ARRAY SCHEMAS FOR BULK OPERATIONS
// =====================================================

/**
 * Array schemas for validating collections of GitHub API responses
 */
export const githubUsersArraySchema = z.array(githubUserSchema);
export const githubOrganizationsArraySchema = z.array(githubOrganizationSchema);
export const githubRepositoriesArraySchema = z.array(githubRepositorySchema);
export const githubPullRequestsArraySchema = z.array(githubPullRequestSchema);
export const githubReviewsArraySchema = z.array(githubReviewSchema);
export const githubCommentsArraySchema = z.array(githubCommentSchema);
export const githubReviewCommentsArraySchema = z.array(githubReviewCommentSchema);
export const githubCommitsArraySchema = z.array(githubCommitSchema);

// =====================================================
// ERROR RESPONSE SCHEMAS
// =====================================================

/**
 * GitHub API error response schema
 */
export const githubErrorSchema = z.object({
  message: z.string(),
  documentation_url: z.string().url().optional(),
  errors: z.array(z.object({
    resource: z.string().optional(),
    field: z.string().optional(),
    code: z.string(),
    message: z.string().optional(),
  })).optional(),
});

/**
 * Rate limit response schema
 */
export const githubRateLimitSchema = z.object({
  limit: z.number().int().min(0),
  remaining: z.number().int().min(0),
  reset: z.number().int().positive(),
  used: z.number().int().min(0),
  resource: z.string().optional(),
});

// =====================================================
// TYPE EXPORTS
// =====================================================

export type GitHubUser = z.infer<typeof githubUserSchema>;
export type GitHubOrganization = z.infer<typeof githubOrganizationSchema>;
export type GitHubRepository = z.infer<typeof githubRepositorySchema>;
export type GitHubPullRequest = z.infer<typeof githubPullRequestSchema>;
export type GitHubReview = z.infer<typeof githubReviewSchema>;
export type GitHubComment = z.infer<typeof githubCommentSchema>;
export type GitHubReviewComment = z.infer<typeof githubReviewCommentSchema>;
export type GitHubCommit = z.infer<typeof githubCommitSchema>;
export type GitHubError = z.infer<typeof githubErrorSchema>;
export type GitHubRateLimit = z.infer<typeof githubRateLimitSchema>;

// Array types
export type GitHubUsers = z.infer<typeof githubUsersArraySchema>;
export type GitHubOrganizations = z.infer<typeof githubOrganizationsArraySchema>;
export type GitHubRepositories = z.infer<typeof githubRepositoriesArraySchema>;
export type GitHubPullRequests = z.infer<typeof githubPullRequestsArraySchema>;
export type GitHubReviews = z.infer<typeof githubReviewsArraySchema>;
export type GitHubComments = z.infer<typeof githubCommentsArraySchema>;
export type GitHubReviewComments = z.infer<typeof githubReviewCommentsArraySchema>;
export type GitHubCommits = z.infer<typeof githubCommitsArraySchema>;