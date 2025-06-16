/**
 * Integration helpers for validating GitHub API responses
 * Shows how to integrate validation schemas with existing GitHub API functions
 */

import { 
  githubUserSchema,
  githubRepositorySchema,
  githubPullRequestSchema,
  githubReviewSchema,
  githubCommentSchema,
  contributorCreateSchema,
  repositoryCreateSchema,
  pullRequestCreateSchema,
  validateData,
  type GitHubUser,
  type GitHubRepository,
  type GitHubPullRequest,
  type GitHubReview,
  type GitHubComment,
  type ContributorCreate,
  type RepositoryCreate,
  type PullRequestCreate,
  type ReviewCreate,
  type CommentCreate,
} from './index';

// =====================================================
// GITHUB API RESPONSE VALIDATION
// =====================================================

/**
 * Validates a GitHub user response from the API
 */
export function validateGitHubUser(userData: unknown): GitHubUser | null {
  const result = validateData(githubUserSchema, userData, 'GitHub user');
  return result.success && result.data ? result.data : null;
}

/**
 * Validates a GitHub repository response from the API
 */
export function validateGitHubRepository(repoData: unknown): GitHubRepository | null {
  const result = validateData(githubRepositorySchema, repoData, 'GitHub repository');
  return result.success && result.data ? result.data : null;
}

/**
 * Validates a GitHub pull request response from the API
 */
export function validateGitHubPullRequest(prData: unknown): GitHubPullRequest | null {
  const result = validateData(githubPullRequestSchema, prData, 'GitHub pull request');
  return result.success && result.data ? result.data : null;
}

/**
 * Validates a GitHub review response from the API
 */
export function validateGitHubReview(reviewData: unknown): GitHubReview | null {
  const result = validateData(githubReviewSchema, reviewData, 'GitHub review');
  return result.success && result.data ? result.data : null;
}

/**
 * Validates a GitHub comment response from the API
 */
export function validateGitHubComment(commentData: unknown): GitHubComment | null {
  const result = validateData(githubCommentSchema, commentData, 'GitHub comment');
  return result.success && result.data ? result.data : null;
}

// =====================================================
// TRANSFORMATION HELPERS
// =====================================================

/**
 * Transforms GitHub user data into database contributor format
 */
export function transformGitHubUserToContributor(githubUser: GitHubUser): ContributorCreate {
  const result = {
    github_id: githubUser.id,
    username: githubUser.login,
    display_name: githubUser.name || null,
    avatar_url: githubUser.avatar_url,
    profile_url: githubUser.html_url,
    email: githubUser.email || null,
    company: githubUser.company || null,
    location: githubUser.location || null,
    bio: githubUser.bio || null,
    blog: githubUser.blog || null,
    public_repos: (githubUser.public_repos ?? 0) as number,
    public_gists: (githubUser.public_gists ?? 0) as number,
    followers: (githubUser.followers ?? 0) as number,
    following: (githubUser.following ?? 0) as number,
    github_created_at: githubUser.created_at ? new Date(githubUser.created_at) : null,
    is_bot: githubUser.type === 'Bot',
    is_active: true as boolean,
  };
  return result;
}

/**
 * Transforms GitHub repository data into database repository format
 */
export function transformGitHubRepositoryToRepository(githubRepo: GitHubRepository): RepositoryCreate {
  const result = {
    github_id: githubRepo.id,
    full_name: githubRepo.full_name,
    owner: githubRepo.owner.login,
    name: githubRepo.name,
    description: githubRepo.description,
    homepage: githubRepo.homepage,
    language: githubRepo.language,
    stargazers_count: githubRepo.stargazers_count,
    watchers_count: githubRepo.watchers_count,
    forks_count: githubRepo.forks_count,
    open_issues_count: githubRepo.open_issues_count,
    size: (githubRepo.size ?? 0) as number,
    default_branch: githubRepo.default_branch,
    is_fork: githubRepo.fork,
    is_archived: githubRepo.archived,
    is_disabled: githubRepo.disabled,
    is_private: githubRepo.private,
    has_issues: githubRepo.has_issues,
    has_projects: githubRepo.has_projects,
    has_wiki: githubRepo.has_wiki,
    has_pages: githubRepo.has_pages,
    has_downloads: githubRepo.has_downloads,
    license: githubRepo.license?.spdx_id || null,
    topics: githubRepo.topics || [],
    github_created_at: new Date(githubRepo.created_at),
    github_updated_at: new Date(githubRepo.updated_at),
    github_pushed_at: githubRepo.pushed_at ? new Date(githubRepo.pushed_at) : null,
    is_active: true as boolean,
  };
  return result;
}

/**
 * Transforms GitHub pull request data into database pull request format
 */
export function transformGitHubPullRequestToPullRequest(
  githubPR: GitHubPullRequest,
  repositoryId: string,
  authorId: string,
  assigneeId?: string,
  mergedById?: string
): PullRequestCreate {
  return {
    github_id: githubPR.id,
    number: githubPR.number,
    title: githubPR.title,
    body: githubPR.body,
    state: githubPR.state,
    repository_id: repositoryId,
    author_id: authorId,
    assignee_id: assigneeId || null,
    base_branch: githubPR.base.ref,
    head_branch: githubPR.head.ref,
    draft: githubPR.draft,
    mergeable: githubPR.mergeable,
    mergeable_state: githubPR.mergeable_state,
    merged: githubPR.merged ?? false,
    merged_by_id: mergedById || null,
    created_at: new Date(githubPR.created_at),
    updated_at: new Date(githubPR.updated_at),
    merged_at: githubPR.merged_at ? new Date(githubPR.merged_at) : null,
    closed_at: githubPR.closed_at ? new Date(githubPR.closed_at) : null,
    additions: githubPR.additions ?? 0,
    deletions: githubPR.deletions ?? 0,
    changed_files: githubPR.changed_files ?? 0,
    commits: githubPR.commits ?? 0,
    html_url: githubPR.html_url || null,
    diff_url: githubPR.diff_url || null,
    patch_url: githubPR.patch_url || null,
  };
}

/**
 * Transforms GitHub review data into database review format
 */
export function transformGitHubReviewToReview(
  githubReview: GitHubReview,
  pullRequestId: string,
  reviewerId: string
): ReviewCreate {
  return {
    github_id: githubReview.id,
    pull_request_id: pullRequestId,
    reviewer_id: reviewerId,
    state: githubReview.state,
    body: githubReview.body,
    submitted_at: new Date(githubReview.submitted_at || Date.now()),
    commit_id: githubReview.commit_id,
  };
}

/**
 * Transforms GitHub comment data into database comment format
 */
export function transformGitHubCommentToComment(
  githubComment: GitHubComment,
  pullRequestId: string,
  commenterId: string,
  commentType: 'issue_comment' | 'review_comment' = 'issue_comment'
): CommentCreate {
  return {
    github_id: githubComment.id,
    pull_request_id: pullRequestId,
    commenter_id: commenterId,
    body: githubComment.body,
    created_at: new Date(githubComment.created_at),
    updated_at: new Date(githubComment.updated_at),
    comment_type: commentType,
    in_reply_to_id: null, // Would need to be determined from context
    position: null, // Only for review comments
    original_position: null, // Only for review comments
    diff_hunk: null, // Only for review comments
    path: null, // Only for review comments
    commit_id: null, // Only for review comments
  };
}

// =====================================================
// VALIDATED TRANSFORMATION FUNCTIONS
// =====================================================

/**
 * Validates GitHub user data and transforms it for database storage
 */
export function validateAndTransformGitHubUser(userData: unknown): ContributorCreate | null {
  // First validate the input
  const inputValidation = validateData(githubUserSchema, userData, 'GitHub user');
  if (!inputValidation.success || !inputValidation.data) {
    return null;
  }
  
  // Transform the validated data
  const transformed = transformGitHubUserToContributor(inputValidation.data);
  
  // Validate the transformed data
  const outputValidation = validateData(contributorCreateSchema, transformed, 'Transformed contributor');
  if (!outputValidation.success || !outputValidation.data) {
    return null;
  }
  
  return outputValidation.data;
}

/**
 * Validates GitHub repository data and transforms it for database storage
 */
export function validateAndTransformGitHubRepository(repoData: unknown): RepositoryCreate | null {
  // First validate the input
  const inputValidation = validateData(githubRepositorySchema, repoData, 'GitHub repository');
  if (!inputValidation.success || !inputValidation.data) {
    return null;
  }
  
  // Transform the validated data
  const transformed = transformGitHubRepositoryToRepository(inputValidation.data);
  
  // Validate the transformed data
  const outputValidation = validateData(repositoryCreateSchema, transformed, 'Transformed repository');
  if (!outputValidation.success || !outputValidation.data) {
    return null;
  }
  
  return outputValidation.data;
}

/**
 * Validates GitHub pull request data and transforms it for database storage
 */
export function validateAndTransformGitHubPullRequest(
  prData: unknown,
  repositoryId: string,
  authorId: string,
  assigneeId?: string,
  mergedById?: string
): PullRequestCreate | null {
  // First validate the input
  const inputValidation = validateData(githubPullRequestSchema, prData, 'GitHub pull request');
  if (!inputValidation.success || !inputValidation.data) {
    return null;
  }
  
  // Transform the validated data
  const transformed = transformGitHubPullRequestToPullRequest(
    inputValidation.data, 
    repositoryId, 
    authorId, 
    assigneeId, 
    mergedById
  );
  
  // Validate the transformed data
  const outputValidation = validateData(pullRequestCreateSchema, transformed, 'Transformed pull request');
  if (!outputValidation.success || !outputValidation.data) {
    return null;
  }
  
  return outputValidation.data;
}

// =====================================================
// BATCH VALIDATION HELPERS
// =====================================================

/**
 * Validates and transforms an array of GitHub users
 */
export function validateAndTransformGitHubUsers(usersData: unknown[]): ContributorCreate[] {
  return usersData
    .map(validateAndTransformGitHubUser)
    .filter((user): user is ContributorCreate => user !== null);
}

/**
 * Validates and transforms an array of GitHub repositories
 */
export function validateAndTransformGitHubRepositories(reposData: unknown[]): RepositoryCreate[] {
  return reposData
    .map(validateAndTransformGitHubRepository)
    .filter((repo): repo is RepositoryCreate => repo !== null);
}

/**
 * Validates and transforms an array of GitHub pull requests
 */
export function validateAndTransformGitHubPullRequests(
  prsData: unknown[],
  getRepositoryId: (pr: GitHubPullRequest) => string,
  getAuthorId: (pr: GitHubPullRequest) => string,
  getAssigneeId?: (pr: GitHubPullRequest) => string | undefined,
  getMergedById?: (pr: GitHubPullRequest) => string | undefined
): PullRequestCreate[] {
  return prsData
    .map((prData) => {
      const githubPR = validateGitHubPullRequest(prData);
      if (!githubPR) return null;
      
      const repositoryId = getRepositoryId(githubPR);
      const authorId = getAuthorId(githubPR);
      const assigneeId = getAssigneeId?.(githubPR);
      const mergedById = getMergedById?.(githubPR);
      
      return validateAndTransformGitHubPullRequest(prData, repositoryId, authorId, assigneeId, mergedById);
    })
    .filter((pr): pr is PullRequestCreate => pr !== null);
}

// =====================================================
// ERROR HANDLING HELPERS
// =====================================================

/**
 * Safely validates GitHub API response with detailed error logging
 */
export function safeValidateGitHubResponse<T>(
  schema: any,
  data: unknown,
  context: string,
  logger?: (message: string, data?: any) => void
): T | null {
  const result = validateData(schema, data, context);
  
  if (!result.success) {
    const errorMessage = `Failed to validate ${context}: ${result.error}`;
    
    if (logger) {
      logger(errorMessage, {
        errors: result.errors,
        receivedData: data,
      });
    } else {
      console.warn(errorMessage, result.errors);
    }
    
    return null;
  }
  
  return result.data as T;
}

/**
 * Creates a standardized error handler for GitHub API validation
 */
export function createGitHubValidationErrorHandler(
  onError: (error: string, context: string, data?: any) => void
) {
  return <T>(schema: any, data: unknown, context: string): T | null => {
    return safeValidateGitHubResponse<T>(schema, data, context, (message, errorData) => {
      onError(message, context, errorData);
    });
  };
}