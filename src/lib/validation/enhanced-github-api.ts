/**
 * Enhanced GitHub API functions with validation
 * Example of how to integrate validation with existing GitHub API functions
 */

import { supabase } from '../supabase';
import { detectBot } from '@/lib/utils/bot-detection';
import {
  validateGitHubPullRequest,
  validateGitHubRepository,
  validateAndTransformGitHubRepository,
  safeValidateGitHubResponse,
} from './github-integration';
import {
  githubPullRequestsArraySchema,
  githubUsersArraySchema,
  githubReviewsArraySchema,
  githubCommentsArraySchema,
} from './github-api-schemas';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Enhanced version of fetchPullRequests with validation
 * This is an example of how to integrate validation into existing API functions
 */
export async function fetchPullRequestsWithValidation(
  owner: string,
  repo: string,
  timeRange: string = '30'
): Promise<{
  pullRequests: Array<{
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    closed_at?: string | null;
    additions: number;
    deletions: number;
    repository_owner: string;
    repository_name: string;
    user: {
      id: number;
      login: string;
      avatar_url: string;
      type?: 'User' | 'Bot';
    };
    html_url?: string;
    reviews?: Array<any>;
    comments?: Array<any>;
  }>;
  validationErrors: Array<{
    index: number;
    error: string;
    rawData: unknown;
  }>;
}> {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
  };

  // Try to get user's GitHub token from Supabase session
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env token
  const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  const validationErrors: Array<{
    index: number;
    error: string;
    rawData: unknown;
  }> = [];

  try {
    // Calculate date range based on timeRange parameter
    const since = new Date();
    since.setDate(since.getDate() - parseInt(timeRange));

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100&since=${since.toISOString()}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 404) {
        throw new Error(
          `Repository "${owner}/${repo}" not found. Please check if the repository exists and is public.`
        );
      } else if (response.status === 403 && error.message?.includes('rate limit')) {
        if (!token) {
          throw new Error(
            'GitHub API rate limit exceeded. Please log in with GitHub to increase the rate limit.'
          );
        } else {
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
      } else if (response.status === 401) {
        throw new Error(
          "Invalid GitHub token. Please check your token and try again. Make sure you've copied the entire token correctly."
        );
      }
      throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }

    const rawPullRequests = await response.json();

    // Validate the array of pull requests
    const arrayValidationResult = safeValidateGitHubResponse(
      githubPullRequestsArraySchema,
      rawPullRequests,
      'GitHub pull requests array'
    );

    if (!arrayValidationResult) {
      console.warn('Failed to validate pull requests array, processing individually');
    }

    // Filter PRs by the time range
    const filteredPRs = rawPullRequests.filter((pr: any) => {
      const prDate = new Date(pr.updated_at);
      return prDate >= since;
    });

    // Process each PR with validation
    const validatedPullRequests = await Promise.all(
      filteredPRs.map(async (pr: any, index: number) => {
        try {
          // Validate the basic PR data first
          const validatedPR = validateGitHubPullRequest(pr);
          if (!validatedPR) {
            validationErrors.push({
              index,
              error: 'Failed to validate pull request data',
              rawData: pr,
            });
            return null;
          }

          // Fetch additional details for each PR to get additions/deletions
          const detailsResponse = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}`,
            { headers }
          );

          if (!detailsResponse.ok) {
            console.warn(`Failed to fetch details for PR #${pr.number}`);
            // Use basic data without detailed stats
            return {
              id: validatedPR.id,
              number: validatedPR.number,
              title: validatedPR.title,
              state: validatedPR.state,
              created_at: validatedPR.created_at,
              updated_at: validatedPR.updated_at,
              merged_at: validatedPR.merged_at,
              closed_at: validatedPR.closed_at,
              additions: 0,
              deletions: 0,
              repository_owner: owner,
              repository_name: repo,
              html_url: validatedPR.html_url || undefined,
              user: {
                id: validatedPR.user.id,
                login: validatedPR.user.login,
                avatar_url: validatedPR.user.avatar_url,
                type: validatedPR.user.type,
              },
              reviews: [],
              comments: [],
            };
          }

          const detailsData = await detailsResponse.json();
          const validatedDetails = validateGitHubPullRequest(detailsData);

          if (!validatedDetails) {
            validationErrors.push({
              index,
              error: 'Failed to validate pull request details',
              rawData: detailsData,
            });
            // Use basic validated data
            return {
              id: validatedPR.id,
              number: validatedPR.number,
              title: validatedPR.title,
              state: validatedPR.state,
              created_at: validatedPR.created_at,
              updated_at: validatedPR.updated_at,
              merged_at: validatedPR.merged_at,
              closed_at: validatedPR.closed_at,
              additions: 0,
              deletions: 0,
              repository_owner: owner,
              repository_name: repo,
              html_url: validatedPR.html_url || undefined,
              user: {
                id: validatedPR.user.id,
                login: validatedPR.user.login,
                avatar_url: validatedPR.user.avatar_url,
                type: validatedPR.user.type,
              },
              reviews: [],
              comments: [],
            };
          }

          // Fetch PR reviews and comments (in parallel)
          const [reviewsResponse, commentsResponse] = await Promise.all([
            fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}/reviews`, {
              headers,
            }),
            fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${pr.number}/comments`, {
              headers,
            }),
          ]);

          let validatedReviews: any[] = [];
          let validatedComments: any[] = [];

          // Validate reviews
          if (reviewsResponse.ok) {
            const reviewsData = await reviewsResponse.json();
            const reviewsValidation = safeValidateGitHubResponse(
              githubReviewsArraySchema,
              reviewsData,
              `PR #${pr.number} reviews`
            );

            if (Array.isArray(reviewsValidation)) {
              validatedReviews = reviewsValidation.map((review: any) => ({
                id: review.id,
                state: review.state,
                user: {
                  login: review.user.login,
                  avatar_url: review.user.avatar_url,
                },
                submitted_at: review.submitted_at,
              }));
            } else {
              validationErrors.push({
                index,
                error: `Failed to validate reviews for PR #${pr.number}`,
                rawData: reviewsData,
              });
            }
          }

          // Validate comments
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            const commentsValidation = safeValidateGitHubResponse(
              githubCommentsArraySchema,
              commentsData,
              `PR #${pr.number} comments`
            );

            if (Array.isArray(commentsValidation)) {
              validatedComments = commentsValidation.map((comment: any) => ({
                id: comment.id,
                user: {
                  login: comment.user.login,
                  avatar_url: comment.user.avatar_url,
                },
                created_at: comment.created_at,
              }));
            } else {
              validationErrors.push({
                index,
                error: `Failed to validate comments for PR #${pr.number}`,
                rawData: commentsData,
              });
            }
          }

          // Use comprehensive bot detection instead of basic pattern matching
          const isBot = detectBot({ githubUser: validatedDetails.user }).isBot;

          return {
            id: validatedDetails.id,
            number: validatedDetails.number,
            title: validatedDetails.title,
            state: validatedDetails.state,
            created_at: validatedDetails.created_at,
            updated_at: validatedDetails.updated_at,
            merged_at: validatedDetails.merged_at,
            closed_at: validatedDetails.closed_at,
            additions: validatedDetails.additions,
            deletions: validatedDetails.deletions,
            repository_owner: owner,
            repository_name: repo,
            html_url: validatedDetails.html_url || undefined,
            user: {
              id: validatedDetails.user.id,
              login: validatedDetails.user.login,
              avatar_url: validatedDetails.user.avatar_url,
              type: isBot ? ('Bot' as const) : ('User' as const),
            },
            reviews: validatedReviews,
            comments: validatedComments,
          };
        } catch (error) {
          validationErrors.push({
            index,
            error: `Error processing PR #${pr.number}: ${String(error)}`,
            rawData: pr,
          });
          return null;
        }
      })
    );

    // Filter out null results (failed validations)
    const successfulPullRequests = validatedPullRequests.filter(
      (pr): pr is NonNullable<typeof pr> => pr !== null
    );

    return {
      pullRequests: successfulPullRequests,
      validationErrors,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while fetching repository data.');
  }
}

/**
 * Enhanced function to fetch and validate user organizations
 */
export async function fetchUserOrganizationsWithValidation(
  username: string,
  headers: HeadersInit
): Promise<{
  organizations: Array<{ login: string; avatar_url: string }>;
  validationErrors: Array<{ error: string; rawData: unknown }>;
}> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/users/${username}/orgs`, { headers });

    if (!response.ok) {
      return {
        organizations: [],
        validationErrors: [
          { error: `Failed to fetch organizations: ${response.statusText}`, rawData: null },
        ],
      };
    }

    const orgsData = await response.json();
    const validationErrors: Array<{ error: string; rawData: unknown }> = [];

    // Validate the organizations array
    const validatedOrgs = safeValidateGitHubResponse(
      githubUsersArraySchema, // Organizations use same schema as users
      orgsData,
      `Organizations for user ${username}`
    );

    if (!validatedOrgs) {
      validationErrors.push({
        error: 'Failed to validate organizations array',
        rawData: orgsData,
      });
      return {
        organizations: [],
        validationErrors,
      };
    }

    const organizations = Array.isArray(validatedOrgs)
      ? validatedOrgs.slice(0, 3).map((org: any) => ({
          login: org.login,
          avatar_url: org.avatar_url,
        }))
      : [];

    return {
      organizations,
      validationErrors,
    };
  } catch (error) {
    console.error('Error fetching user organizations:', error);
    return {
      organizations: [],
      validationErrors: [{ error: String(error), rawData: null }],
    };
  }
}

/**
 * Enhanced function to fetch and validate repository data
 */
export async function fetchRepositoryWithValidation(
  owner: string,
  repo: string,
  headers: HeadersInit
): Promise<{
  repository: any | null;
  validationErrors: Array<{ error: string; rawData: unknown }>;
}> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });

    if (!response.ok) {
      return {
        repository: null,
        validationErrors: [
          { error: `Failed to fetch repository: ${response.statusText}`, rawData: null },
        ],
      };
    }

    const repoData = await response.json();
    const validationErrors: Array<{ error: string; rawData: unknown }> = [];

    // Validate the repository data
    const validatedRepo = validateGitHubRepository(repoData);

    if (!validatedRepo) {
      validationErrors.push({
        error: 'Failed to validate repository data',
        rawData: repoData,
      });
      return {
        repository: null,
        validationErrors,
      };
    }

    // Transform to our internal format if needed
    const transformedRepo = validateAndTransformGitHubRepository(repoData);

    return {
      repository: transformedRepo,
      validationErrors,
    };
  } catch (error) {
    console.error('Error fetching repository:', error);
    return {
      repository: null,
      validationErrors: [{ error: String(error), rawData: null }],
    };
  }
}

/**
 * Validation middleware that can be used to wrap existing API functions
 */
export function withValidation<TInput, TOutput>(
  apiFunction: (input: TInput) => Promise<TOutput>,
  validator?: (output: TOutput) => boolean,
  onValidationError?: (error: string, input: TInput, output: TOutput) => void
) {
  return async (input: TInput): Promise<TOutput> => {
    const output = await apiFunction(input);

    if (validator && !validator(output)) {
      const error = 'API response validation failed';

      if (onValidationError) {
        onValidationError(error, input, output);
      } else {
        console.warn(error, { input, output });
      }
    }

    return output;
  };
}
