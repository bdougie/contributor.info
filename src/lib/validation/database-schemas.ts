/**
 * Zod validation schemas for database tables and operations
 * These schemas mirror the database structure from supabase/migrations/20240614000000_initial_contributor_schema.sql
 * and provide comprehensive input validation for all database operations.
 */

import { z } from 'zod';

// =====================================================
// BASE VALIDATION HELPERS
// =====================================================

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * GitHub ID validation schema (64-bit integer)
 */
export const githubIdSchema = z
  .number()
  .int('GitHub ID must be an integer')
  .positive('GitHub ID must be positive')
  .max(Number.MAX_SAFE_INTEGER, 'GitHub ID too large');

/**
 * GitHub username validation schema
 * Based on GitHub's username requirements: 1-39 characters, alphanumeric and hyphens
 */
export const githubUsernameSchema = z
  .string()
  .min(1, 'Username cannot be empty')
  .max(39, 'Username cannot exceed 39 characters')
  .regex(/^[a-zA-Z0-9-]+$/, 'Username can only contain alphanumeric characters and hyphens')
  .refine(
    (username) => !username.startsWith('-') && !username.endsWith('-'),
    'Username cannot start or end with hyphen'
  );

/**
 * Repository name validation schema
 * Based on GitHub repository naming rules
 */
export const repoNameSchema = z
  .string()
  .min(1, 'Repository name cannot be empty')
  .max(100, 'Repository name cannot exceed 100 characters')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Repository name contains invalid characters');

/**
 * Repository full name validation schema (owner/repo format)
 */
export const repoFullNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9-]+\/[a-zA-Z0-9._-]+$/, 'Invalid repository full name format');

/**
 * URL validation schema with optional null
 */
export const urlSchema = z.string().url('Invalid URL format').nullable();

/**
 * Email validation schema with optional null
 */
export const emailSchema = z.string().email('Invalid email format').nullable();

/**
 * Non-negative integer schema
 */
export const nonNegativeIntSchema = z
  .number()
  .int('Must be an integer')
  .min(0, 'Must be non-negative');

/**
 * Positive integer schema
 */
export const positiveIntSchema = z.number().int('Must be an integer').positive('Must be positive');

// =====================================================
// CORE TABLE SCHEMAS
// =====================================================

/**
 * Contributors table schema
 */
export const contributorCreateSchema = z.object({
  github_id: githubIdSchema,
  username: githubUsernameSchema,
  display_name: z.string().max(255, 'Display name too long').nullable(),
  avatar_url: urlSchema,
  profile_url: urlSchema,
  discord_url: urlSchema,
  linkedin_url: urlSchema,
  email: emailSchema,
  company: z.string().max(255, 'Company name too long').nullable(),
  location: z.string().max(255, 'Location too long').nullable(),
  bio: z.string().max(1000, 'Bio too long').nullable(),
  blog: urlSchema,
  public_repos: nonNegativeIntSchema.default(0),
  public_gists: nonNegativeIntSchema.default(0),
  followers: nonNegativeIntSchema.default(0),
  following: nonNegativeIntSchema.default(0),
  github_created_at: z.coerce.date().nullable(),
  is_bot: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const contributorUpdateSchema = contributorCreateSchema.partial().omit({
  github_id: true, // Cannot update GitHub ID
});

export const contributorSelectSchema = contributorCreateSchema.extend({
  id: uuidSchema,
  first_seen_at: z.coerce.date(),
  last_updated_at: z.coerce.date(),
});

/**
 * Organizations table schema
 */
export const organizationCreateSchema = z.object({
  github_id: githubIdSchema,
  login: githubUsernameSchema,
  avatar_url: urlSchema,
  description: z.string().max(1000, 'Description too long').nullable(),
  company: z.string().max(255, 'Company name too long').nullable(),
  blog: urlSchema,
  location: z.string().max(255, 'Location too long').nullable(),
  email: emailSchema,
  public_repos: nonNegativeIntSchema.default(0),
  public_gists: nonNegativeIntSchema.default(0),
  followers: nonNegativeIntSchema.default(0),
  following: nonNegativeIntSchema.default(0),
  github_created_at: z.coerce.date().nullable(),
  is_active: z.boolean().default(true),
});

export const organizationUpdateSchema = organizationCreateSchema.partial().omit({
  github_id: true,
});

export const organizationSelectSchema = organizationCreateSchema.extend({
  id: uuidSchema,
  first_seen_at: z.coerce.date(),
  last_updated_at: z.coerce.date(),
});

/**
 * Repositories table schema
 */
export const repositoryCreateSchema = z.object({
  github_id: githubIdSchema,
  full_name: repoFullNameSchema,
  owner: githubUsernameSchema,
  name: repoNameSchema,
  description: z.string().max(1000, 'Description too long').nullable(),
  homepage: urlSchema,
  language: z.string().max(50, 'Language name too long').nullable(),
  stargazers_count: nonNegativeIntSchema.default(0),
  watchers_count: nonNegativeIntSchema.default(0),
  forks_count: nonNegativeIntSchema.default(0),
  open_issues_count: nonNegativeIntSchema.default(0),
  size: nonNegativeIntSchema.default(0),
  default_branch: z.string().max(255, 'Branch name too long').default('main'),
  is_fork: z.boolean().default(false),
  is_archived: z.boolean().default(false),
  is_disabled: z.boolean().default(false),
  is_private: z.boolean().default(false),
  has_issues: z.boolean().default(true),
  has_projects: z.boolean().default(true),
  has_wiki: z.boolean().default(true),
  has_pages: z.boolean().default(false),
  has_downloads: z.boolean().default(true),
  license: z.string().max(50, 'License identifier too long').nullable(),
  topics: z.array(z.string().max(50, 'Topic too long')).default([]),
  github_created_at: z.coerce.date().nullable(),
  github_updated_at: z.coerce.date().nullable(),
  github_pushed_at: z.coerce.date().nullable(),
  is_active: z.boolean().default(true),
});

export const repositoryUpdateSchema = repositoryCreateSchema.partial().omit({
  github_id: true,
});

export const repositorySelectSchema = repositoryCreateSchema.extend({
  id: uuidSchema,
  first_tracked_at: z.coerce.date(),
  last_updated_at: z.coerce.date(),
});

/**
 * Pull requests table schema
 */
export const pullRequestStateSchema = z.enum(['open', 'closed'], {
  errorMap: () => ({ message: 'Pull request state must be either "open" or "closed"' }),
});

// Base schema without refinement for partial operations
const pullRequestBaseSchema = z.object({
  github_id: githubIdSchema,
  number: positiveIntSchema,
  title: z.string().min(1, 'Title cannot be empty').max(500, 'Title too long'),
  body: z.string().max(10000, 'Body too long').nullable(),
  state: pullRequestStateSchema,
  repository_id: uuidSchema,
  author_id: uuidSchema,
  assignee_id: uuidSchema.nullable(),
  base_branch: z.string().max(255, 'Branch name too long').default('main'),
  head_branch: z.string().max(255, 'Branch name too long'),
  draft: z.boolean().default(false),
  mergeable: z.boolean().nullable(),
  mergeable_state: z.string().max(50, 'Mergeable state too long').nullable(),
  merged: z.boolean().default(false),
  merged_by_id: uuidSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  merged_at: z.coerce.date().nullable(),
  closed_at: z.coerce.date().nullable(),
  additions: nonNegativeIntSchema.default(0),
  deletions: nonNegativeIntSchema.default(0),
  changed_files: nonNegativeIntSchema.default(0),
  commits: nonNegativeIntSchema.default(0),
  html_url: urlSchema,
  diff_url: urlSchema,
  patch_url: urlSchema,
});

export const pullRequestCreateSchema = pullRequestBaseSchema.refine(
  (data) => {
    // If merged is true, merged_at should be set
    if (data.merged && !data.merged_at) {
      return false;
    }
    // If closed, closed_at should be set
    if (data.state === 'closed' && !data.closed_at) {
      return false;
    }
    return true;
  },
  {
    message: 'Merged PRs must have merged_at timestamp, closed PRs must have closed_at timestamp',
  }
);

export const pullRequestUpdateSchema = pullRequestBaseSchema.partial().omit({
  github_id: true,
});

export const pullRequestSelectSchema = pullRequestBaseSchema
  .extend({
    id: uuidSchema,
  })
  .refine(
    (data) => {
      // If merged is true, merged_at should be set
      if (data.merged && !data.merged_at) {
        return false;
      }
      // If closed, closed_at should be set
      if (data.state === 'closed' && !data.closed_at) {
        return false;
      }
      return true;
    },
    {
      message: 'Merged PRs must have merged_at timestamp, closed PRs must have closed_at timestamp',
    }
  );

/**
 * Reviews table schema
 */
export const reviewStateSchema = z.enum(
  ['PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED'],
  {
    errorMap: () => ({ message: 'Invalid review state' }),
  }
);

export const reviewCreateSchema = z.object({
  github_id: githubIdSchema,
  pull_request_id: uuidSchema,
  reviewer_id: uuidSchema,
  state: reviewStateSchema,
  body: z.string().max(10000, 'Review body too long').nullable(),
  submitted_at: z.coerce.date(),
  commit_id: z.string().max(40, 'Commit ID too long').nullable(),
});

export const reviewUpdateSchema = reviewCreateSchema.partial().omit({
  github_id: true,
});

export const reviewSelectSchema = reviewCreateSchema.extend({
  id: uuidSchema,
});

/**
 * Comments table schema
 */
export const commentTypeSchema = z.enum(['issue_comment', 'review_comment'], {
  errorMap: () => ({ message: 'Comment type must be either "issue_comment" or "review_comment"' }),
});

export const commentCreateSchema = z.object({
  github_id: githubIdSchema,
  pull_request_id: uuidSchema,
  commenter_id: uuidSchema,
  body: z.string().min(1, 'Comment body cannot be empty').max(10000, 'Comment body too long'),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  comment_type: commentTypeSchema,
  in_reply_to_id: uuidSchema.nullable(),
  position: z.number().int().positive().nullable(),
  original_position: z.number().int().positive().nullable(),
  diff_hunk: z.string().max(1000, 'Diff hunk too long').nullable(),
  path: z.string().max(500, 'File path too long').nullable(),
  commit_id: z.string().max(40, 'Commit ID too long').nullable(),
});

export const commentUpdateSchema = commentCreateSchema.partial().omit({
  github_id: true,
});

export const commentSelectSchema = commentCreateSchema.extend({
  id: uuidSchema,
});

/**
 * Monthly rankings table schema
 */
const monthlyRankingBaseSchema = z.object({
  month: z.number().int().min(1, 'Month must be 1-12').max(12, 'Month must be 1-12'),
  year: z.number().int().min(2020, 'Year must be >= 2020').max(2100, 'Year must be <= 2100'),
  contributor_id: uuidSchema,
  repository_id: uuidSchema.nullable(),
  rank: positiveIntSchema,
  weighted_score: z.number().min(0, 'Weighted score cannot be negative'),
  pull_requests_count: nonNegativeIntSchema.default(0),
  reviews_count: nonNegativeIntSchema.default(0),
  comments_count: nonNegativeIntSchema.default(0),
  repositories_contributed: nonNegativeIntSchema.default(0),
  lines_added: nonNegativeIntSchema.default(0),
  lines_removed: nonNegativeIntSchema.default(0),
  first_contribution_at: z.coerce.date().nullable(),
  last_contribution_at: z.coerce.date().nullable(),
  is_winner: z.boolean().default(false),
});

export const monthlyRankingCreateSchema = monthlyRankingBaseSchema.refine(
  (data) => {
    // If both contribution dates exist, first should be <= last
    if (data.first_contribution_at && data.last_contribution_at) {
      return data.first_contribution_at <= data.last_contribution_at;
    }
    return true;
  },
  {
    message: 'First contribution date must be before or equal to last contribution date',
  }
);

export const monthlyRankingUpdateSchema = monthlyRankingBaseSchema.partial();

export const monthlyRankingSelectSchema = monthlyRankingBaseSchema
  .extend({
    id: uuidSchema,
    calculated_at: z.coerce.date(),
  })
  .refine(
    (data) => {
      // If both contribution dates exist, first should be <= last
      if (data.first_contribution_at && data.last_contribution_at) {
        return data.first_contribution_at <= data.last_contribution_at;
      }
      return true;
    },
    {
      message: 'First contribution date must be before or equal to last contribution date',
    }
  );

/**
 * Daily activity snapshots table schema
 */
export const dailyActivityCreateSchema = z.object({
  date: z.coerce.date(),
  contributor_id: uuidSchema,
  repository_id: uuidSchema.nullable(),
  pull_requests_opened: nonNegativeIntSchema.default(0),
  pull_requests_merged: nonNegativeIntSchema.default(0),
  pull_requests_closed: nonNegativeIntSchema.default(0),
  reviews_submitted: nonNegativeIntSchema.default(0),
  comments_made: nonNegativeIntSchema.default(0),
  lines_added: nonNegativeIntSchema.default(0),
  lines_removed: nonNegativeIntSchema.default(0),
});

export const dailyActivityUpdateSchema = dailyActivityCreateSchema.partial();

export const dailyActivitySelectSchema = dailyActivityCreateSchema.extend({
  id: uuidSchema,
  created_at: z.coerce.date(),
});

/**
 * Sync logs table schema
 */
export const syncTypeSchema = z.enum(
  ['full_sync', 'incremental_sync', 'repository_sync', 'contributor_sync'],
  {
    errorMap: () => ({ message: 'Invalid sync type' }),
  }
);

export const syncStatusSchema = z.enum(['started', 'completed', 'failed', 'cancelled'], {
  errorMap: () => ({ message: 'Invalid sync status' }),
});

const syncLogBaseSchema = z.object({
  sync_type: syncTypeSchema,
  repository_id: uuidSchema.nullable(),
  status: syncStatusSchema,
  started_at: z.coerce.date().default(() => new Date()),
  completed_at: z.coerce.date().nullable(),
  records_processed: nonNegativeIntSchema.default(0),
  records_inserted: nonNegativeIntSchema.default(0),
  records_updated: nonNegativeIntSchema.default(0),
  records_failed: nonNegativeIntSchema.default(0),
  error_message: z.string().max(2000, 'Error message too long').nullable(),
  github_api_calls_used: nonNegativeIntSchema.default(0),
  rate_limit_remaining: nonNegativeIntSchema.nullable(),
  metadata: z.record(z.unknown()).nullable(),
});

export const syncLogCreateSchema = syncLogBaseSchema.refine(
  (data) => {
    // If status is completed or failed, completed_at should be set
    if (['completed', 'failed', 'cancelled'].includes(data.status) && !data.completed_at) {
      return false;
    }
    // If status is failed, error_message should be set
    if (data.status === 'failed' && !data.error_message) {
      return false;
    }
    return true;
  },
  {
    message:
      'Completed/failed syncs must have completed_at timestamp, failed syncs must have error_message',
  }
);

export const syncLogUpdateSchema = syncLogBaseSchema.partial();

export const syncLogSelectSchema = syncLogBaseSchema.extend({
  id: uuidSchema,
});

// =====================================================
// JUNCTION TABLE SCHEMAS
// =====================================================

/**
 * Contributor organizations junction table schema
 */
export const contributorOrganizationCreateSchema = z.object({
  contributor_id: uuidSchema,
  organization_id: uuidSchema,
  role: z.string().max(50, 'Role name too long').nullable(),
  is_public: z.boolean().default(false),
  joined_at: z.coerce.date().nullable(),
});

export const contributorOrganizationUpdateSchema = contributorOrganizationCreateSchema.partial();

export const contributorOrganizationSelectSchema = contributorOrganizationCreateSchema.extend({
  id: uuidSchema,
  created_at: z.coerce.date(),
});

/**
 * Repository size enum schema
 */
export const repositorySizeSchema = z.enum(['small', 'medium', 'large', 'xl'], {
  errorMap: () => ({ message: 'Repository size must be one of: small, medium, large, xl' }),
});

/**
 * Repository priority enum schema
 */
export const repositoryPrioritySchema = z.enum(['high', 'medium', 'low'], {
  errorMap: () => ({ message: 'Repository priority must be one of: high, medium, low' }),
});

/**
 * Repository metrics schema for size classification
 */
export const repositoryMetricsSchema = z
  .object({
    stars: nonNegativeIntSchema,
    forks: nonNegativeIntSchema,
    monthlyPRs: nonNegativeIntSchema,
    monthlyCommits: nonNegativeIntSchema,
    activeContributors: nonNegativeIntSchema,
    lastCalculated: z.coerce.date(),
  })
  .nullable();

/**
 * Tracked repositories table schema
 */
export const trackedRepositoryCreateSchema = z.object({
  repository_id: uuidSchema,
  added_by_user_id: uuidSchema.nullable(),
  tracking_enabled: z.boolean().default(true),
  last_sync_at: z.coerce.date().nullable(),
  sync_frequency_hours: z
    .number()
    .int()
    .min(1, 'Sync frequency must be at least 1 hour')
    .default(24),
  include_forks: z.boolean().default(false),
  include_bots: z.boolean().default(false),
  size: repositorySizeSchema.nullable(),
  priority: repositoryPrioritySchema.default('low'),
  metrics: repositoryMetricsSchema,
  size_calculated_at: z.coerce.date().nullable(),
});

export const trackedRepositoryUpdateSchema = trackedRepositoryCreateSchema.partial();

export const trackedRepositorySelectSchema = trackedRepositoryCreateSchema.extend({
  id: uuidSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

// =====================================================
// BULK OPERATION SCHEMAS
// =====================================================

/**
 * Bulk insert schemas for efficient batch operations
 */
export const bulkContributorInsertSchema = z
  .array(contributorCreateSchema)
  .min(1, 'At least one contributor required');
export const bulkRepositoryInsertSchema = z
  .array(repositoryCreateSchema)
  .min(1, 'At least one repository required');
export const bulkPullRequestInsertSchema = z
  .array(pullRequestCreateSchema)
  .min(1, 'At least one pull request required');
export const bulkReviewInsertSchema = z
  .array(reviewCreateSchema)
  .min(1, 'At least one review required');
export const bulkCommentInsertSchema = z
  .array(commentCreateSchema)
  .min(1, 'At least one comment required');

// =====================================================
// TYPE EXPORTS
// =====================================================

// Export TypeScript types from Zod schemas
export type ContributorCreate = z.infer<typeof contributorCreateSchema>;
export type ContributorUpdate = z.infer<typeof contributorUpdateSchema>;
export type ContributorSelect = z.infer<typeof contributorSelectSchema>;

export type OrganizationCreate = z.infer<typeof organizationCreateSchema>;
export type OrganizationUpdate = z.infer<typeof organizationUpdateSchema>;
export type OrganizationSelect = z.infer<typeof organizationSelectSchema>;

export type RepositoryCreate = z.infer<typeof repositoryCreateSchema>;
export type RepositoryUpdate = z.infer<typeof repositoryUpdateSchema>;
export type RepositorySelect = z.infer<typeof repositorySelectSchema>;

export type PullRequestCreate = z.infer<typeof pullRequestCreateSchema>;
export type PullRequestUpdate = z.infer<typeof pullRequestUpdateSchema>;
export type PullRequestSelect = z.infer<typeof pullRequestSelectSchema>;

export type ReviewCreate = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdate = z.infer<typeof reviewUpdateSchema>;
export type ReviewSelect = z.infer<typeof reviewSelectSchema>;

export type CommentCreate = z.infer<typeof commentCreateSchema>;
export type CommentUpdate = z.infer<typeof commentUpdateSchema>;
export type CommentSelect = z.infer<typeof commentSelectSchema>;

export type MonthlyRankingCreate = z.infer<typeof monthlyRankingCreateSchema>;
export type MonthlyRankingUpdate = z.infer<typeof monthlyRankingUpdateSchema>;
export type MonthlyRankingSelect = z.infer<typeof monthlyRankingSelectSchema>;

export type DailyActivityCreate = z.infer<typeof dailyActivityCreateSchema>;
export type DailyActivityUpdate = z.infer<typeof dailyActivityUpdateSchema>;
export type DailyActivitySelect = z.infer<typeof dailyActivitySelectSchema>;

export type SyncLogCreate = z.infer<typeof syncLogCreateSchema>;
export type SyncLogUpdate = z.infer<typeof syncLogUpdateSchema>;
export type SyncLogSelect = z.infer<typeof syncLogSelectSchema>;

export type ContributorOrganizationCreate = z.infer<typeof contributorOrganizationCreateSchema>;
export type ContributorOrganizationUpdate = z.infer<typeof contributorOrganizationUpdateSchema>;
export type ContributorOrganizationSelect = z.infer<typeof contributorOrganizationSelectSchema>;

export type TrackedRepositoryCreate = z.infer<typeof trackedRepositoryCreateSchema>;
export type TrackedRepositoryUpdate = z.infer<typeof trackedRepositoryUpdateSchema>;
export type TrackedRepositorySelect = z.infer<typeof trackedRepositorySelectSchema>;

export type RepositorySize = z.infer<typeof repositorySizeSchema>;
export type RepositoryPriority = z.infer<typeof repositoryPrioritySchema>;
export type RepositoryMetrics = z.infer<typeof repositoryMetricsSchema>;

// Bulk operation types
export type BulkContributorInsert = z.infer<typeof bulkContributorInsertSchema>;
export type BulkRepositoryInsert = z.infer<typeof bulkRepositoryInsertSchema>;
export type BulkPullRequestInsert = z.infer<typeof bulkPullRequestInsertSchema>;
export type BulkReviewInsert = z.infer<typeof bulkReviewInsertSchema>;
export type BulkCommentInsert = z.infer<typeof bulkCommentInsertSchema>;
