/**
 * Zod validation schemas for Supabase query responses
 * These schemas validate the actual shape of data returned from Supabase queries
 * with joins and nested relationships.
 *
 * Issue #541: Runtime validation for dynamic Supabase responses
 */

import { z } from 'zod';

// =====================================================
// BASE SCHEMAS FOR NESTED OBJECTS
// =====================================================

/**
 * Schema for contributor data when nested in a join query
 * Supabase returns joined data as nested objects
 */
export const supabaseContributorNestedSchema = z
  .object({
    github_id: z.number(),
    username: z.string(),
    avatar_url: z.string(),
    is_bot: z.boolean(),
  })
  .nullable();

/**
 * Schema for review data with nested contributor
 */
export const supabaseReviewWithContributorSchema = z.object({
  id: z.string().uuid(),
  github_id: z.number(),
  state: z.string(),
  body: z.string().nullable(),
  submitted_at: z.string(),
  pull_request_id: z.string().uuid(),
  reviewer_id: z.string().uuid().nullable(),
  author_id: z.string().uuid().nullable(),
  // Nested contributor from reviewer_id join
  contributors: supabaseContributorNestedSchema,
});

/**
 * Schema for comment data with nested contributor (commenter)
 */
export const supabaseCommentWithContributorSchema = z.object({
  id: z.string().uuid(),
  github_id: z.number(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  comment_type: z.enum(['issue_comment', 'review_comment']),
  pull_request_id: z.string().uuid(),
  commenter_id: z.string().uuid(),
  // Nested contributor from commenter_id join
  contributors: supabaseContributorNestedSchema,
});

/**
 * Schema for pull request data with all nested relationships
 * This matches the actual shape returned by Supabase queries with joins
 */
export const supabasePullRequestWithRelationsSchema = z.object({
  id: z.string().uuid(),
  github_id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
  merged: z.boolean().nullable(),
  base_branch: z.string().nullable(),
  head_branch: z.string().nullable(),
  additions: z.number().nullable(),
  deletions: z.number().nullable(),
  changed_files: z.number().nullable(),
  commits: z.number().nullable(),
  html_url: z.string().url('Invalid HTML URL').nullable(),
  repository_id: z.string().uuid(),
  author_id: z.string().uuid().nullable(),
  // Nested contributor from author_id join
  contributors: supabaseContributorNestedSchema,
  // Nested reviews array with contributors
  reviews: z.array(supabaseReviewWithContributorSchema).nullable(),
  // Nested comments array with contributors
  comments: z.array(supabaseCommentWithContributorSchema).nullable(),
});

// Array of pull requests for bulk queries
export const supabasePullRequestArraySchema = z.array(supabasePullRequestWithRelationsSchema);

// =====================================================
// TRANSFORMATION UTILITIES
// =====================================================

/**
 * Transform a Supabase PR response to the application's PullRequest type
 * Handles missing data gracefully with fallback values
 */
export function transformSupabasePRToAppFormat(
  dbPR: z.infer<typeof supabasePullRequestWithRelationsSchema>,
  owner?: string,
  repo?: string
) {
  const contributor = dbPR.contributors || {
    username: `deleted-user-${dbPR.author_id || 'unknown'}`,
    github_id: dbPR.author_id || 0,
    avatar_url: '',
    is_bot: false,
  };

  // Log when we encounter missing contributor data for debugging
  if (!dbPR.contributors && dbPR.author_id) {
    console.warn(`Missing contributor data for PR #${dbPR.number}, author_id: ${dbPR.author_id}`);
  }

  // Generate GitHub URL if missing and we have owner/repo/number
  const generatePRUrl = () => {
    if (dbPR.html_url) return dbPR.html_url;
    if (owner && repo && dbPR.number) {
      return `https://github.com/${owner}/${repo}/pull/${dbPR.number}`;
    }
    return '';
  };

  return {
    id: dbPR.github_id,
    number: dbPR.number,
    title: dbPR.title,
    body: dbPR.body,
    state: dbPR.state as 'open' | 'closed',
    created_at: dbPR.created_at,
    updated_at: dbPR.updated_at,
    closed_at: dbPR.closed_at,
    merged_at: dbPR.merged_at,
    user: {
      login: contributor.username,
      id: contributor.github_id,
      avatar_url: contributor.avatar_url,
      type: (contributor.is_bot ? 'Bot' : 'User') as 'Bot' | 'User',
    },
    additions: dbPR.additions || 0,
    deletions: dbPR.deletions || 0,
    changed_files: dbPR.changed_files || 0,
    html_url: generatePRUrl(),
    repository_owner: owner || '', // These need to be passed in separately
    repository_name: repo || '',
    reviews: (dbPR.reviews || []).map((review) => ({
      id: review.github_id,
      state: review.state,
      body: review.body,
      submitted_at: review.submitted_at,
      user: review.contributors
        ? {
            login: review.contributors.username,
            avatar_url: review.contributors.avatar_url,
          }
        : {
            login: 'unknown',
            avatar_url: '',
          },
    })),
    comments: (dbPR.comments || []).map((comment) => ({
      id: comment.github_id,
      body: comment.body,
      created_at: comment.created_at,
      user: comment.contributors
        ? {
            login: comment.contributors.username,
            avatar_url: comment.contributors.avatar_url,
          }
        : {
            login: 'unknown',
            avatar_url: '',
          },
    })),
  };
}

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

/**
 * Validate a single Supabase pull request response
 * Returns validated data or null with error logging
 */
export function validateSupabasePRResponse(
  data: unknown
):
  | { success: true; data: z.infer<typeof supabasePullRequestWithRelationsSchema> }
  | { success: false; error: string } {
  try {
    const validated = supabasePullRequestWithRelationsSchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('Supabase PR validation failed:', issues);
      return { success: false, error: `Validation failed: ${issues}` };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

/**
 * Validate an array of Supabase pull request responses
 * Returns validated array or empty array with error logging
 */
export function validateSupabasePRArray(
  data: unknown
):
  | { success: true; data: z.infer<typeof supabasePullRequestArraySchema> }
  | { success: false; error: string; fallbackData: [] } {
  try {
    const validated = supabasePullRequestArraySchema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Log validation errors in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Supabase PR array validation failed:', error.errors);
      }

      // Try to salvage valid items from the array
      if (Array.isArray(data)) {
        const validItems: z.infer<typeof supabasePullRequestWithRelationsSchema>[] = [];
        data.forEach((item, index) => {
          const result = validateSupabasePRResponse(item);
          if (result.success) {
            validItems.push(result.data);
          } else {
            console.warn(`Skipping invalid PR at index ${index}:`, result.error);
          }
        });

        if (validItems.length > 0) {
          console.warn(`Recovered ${validItems.length} valid PRs out of ${data.length}`);
          return { success: true, data: validItems };
        }
      }

      return {
        success: false,
        error: 'All items failed validation',
        fallbackData: [],
      };
    }
    return {
      success: false,
      error: 'Unknown validation error',
      fallbackData: [],
    };
  }
}

/**
 * Safe validation with automatic transformation
 * Use this for the main data flow to get properly typed results
 */
export function validateAndTransformPRData(data: unknown, owner: string, repo: string) {
  const validation = validateSupabasePRArray(data);

  if (!validation.success) {
    console.error('Failed to validate PR data for %s/%s:', owner, repo, validation.error);
    return [];
  }

  return validation.data.map((pr) => {
    return transformSupabasePRToAppFormat(pr, owner, repo);
  });
}

// =====================================================
// TYPE EXPORTS
// =====================================================

export type SupabasePullRequestWithRelations = z.infer<
  typeof supabasePullRequestWithRelationsSchema
>;
export type SupabaseReviewWithContributor = z.infer<typeof supabaseReviewWithContributorSchema>;
export type SupabaseCommentWithContributor = z.infer<typeof supabaseCommentWithContributorSchema>;
export type SupabaseContributorNested = z.infer<typeof supabaseContributorNestedSchema>;
