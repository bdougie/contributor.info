import { inngest } from '../client';
import { supabase } from '../../supabase';
import { GraphQLClient } from '../graphql-client';
import type { NonRetriableError } from 'inngest';
import { getMergeableStatus } from '../../utils/performance-helpers';

// Type definitions for GitHub user data
interface GitHubUser {
  databaseId: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

// Type definition for review comment
interface ReviewComment {
  repository_id: string;
  pull_request_id: string;
  github_id: number;
  review_id?: number;
  body: string;
  path?: string;
  position?: number | null;
  original_position?: number | null;
  commit_id?: string;
  original_commit_id?: string;
  diff_hunk?: string;
  commenter_id: string;
  created_at: string;
  updated_at: string;
  in_reply_to_id?: string;
  comment_type: 'review_comment';
}

// GraphQL response types
interface GraphQLReview {
  databaseId: number;
  state: string;
  body: string;
  author: GitHubUser | null;
  submittedAt: string;
  commit?: { oid: string };
  comments?: {
    nodes: GraphQLReviewComment[];
  };
}

interface GraphQLReviewComment {
  databaseId: number;
  author: GitHubUser | null;
  body: string;
  path: string;
  position: number | null;
  originalPosition: number | null;
  commit?: { oid: string };
  originalCommit?: { oid: string };
  diffHunk: string;
  createdAt: string;
  updatedAt: string;
  replyTo?: { databaseId: number };
}

interface GraphQLComment {
  databaseId: number;
  author: GitHubUser | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// GraphQL client instance - lazy initialization to avoid module load failures
let graphqlClient: GraphQLClient | null = null;

function getGraphQLClient(): GraphQLClient {
  if (!graphqlClient) {
    graphqlClient = new GraphQLClient();
  }
  return graphqlClient;
}

// Helper function to ensure contributors exist and return their UUIDs
async function ensureContributorExists(
  githubUser: GitHubUser | null | undefined
): Promise<string | null> {
  if (!githubUser) {
    console.log('ensureContributorExists: githubUser is null/undefined');
    return null;
  }

  if (!githubUser.databaseId) {
    console.log('ensureContributorExists: githubUser.databaseId is missing', {
      login: githubUser.login,
      keys: Object.keys(githubUser),
    });
    return null;
  }

  if (!githubUser.login) {
    console.log('ensureContributorExists: githubUser.login is missing', {
      databaseId: githubUser.databaseId,
      keys: Object.keys(githubUser),
    });
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('contributors')
      .upsert(
        {
          github_id: githubUser.databaseId,
          username: githubUser.login,
          display_name: githubUser.name || null,
          email: githubUser.email || null,
          avatar_url: githubUser.avatarUrl || null,
          profile_url: `https://github.com/${githubUser.login}`,
          // Only include fields that are actually requested in the GraphQL query
          // Other fields like bio, company, etc. are not available in PR author data
          bio: null,
          company: null,
          location: null,
          blog: null,
          public_repos: 0,
          public_gists: 0,
          followers: 0,
          following: 0,
          is_bot: false,
          is_active: true,
          first_seen_at: new Date().toISOString(),
          last_updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'github_id',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error upserting contributor:', error, {
        githubUser: {
          databaseId: githubUser.databaseId,
          login: githubUser.login,
          name: githubUser.name,
          email: githubUser.email,
          avatarUrl: githubUser.avatarUrl,
        },
      });
      return null;
    }

    if (!data) {
      throw new Error(`Failed to ensure contributor exists`);
    }
    return data.id;
  } catch (err) {
    console.error('Exception in ensureContributorExists:', err, {
      githubUser: {
        databaseId: githubUser.databaseId,
        login: githubUser.login,
        keys: Object.keys(githubUser),
      },
    });
    return null;
  }
}

export const capturePrDetailsGraphQL = inngest.createFunction(
  {
    id: 'capture-pr-details-graphql',
    name: 'Capture PR Details (GraphQL)',
    concurrency: {
      limit: 10, // Can increase due to better rate limits
      key: 'event.data.repositoryId',
    },
    throttle: { limit: 50, period: '1m' }, // More generous than REST
    retries: 2,
  },
  { event: 'capture/pr.details.graphql' },
  async ({ event, step }) => {
    const { repositoryId, prNumber, prId, priority } = event.data;

    // Step 1: Get repository details
    const repository = await step.run('get-repository', async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`) as NonRetriableError;
      }

      return data;
    });

    // Step 2: Fetch comprehensive PR data with GraphQL
    const prData = await step.run('fetch-pr-all-data', async () => {
      try {
        const client = getGraphQLClient();
        const result = await client.getPRDetails(
          repository.owner,
          repository.name,
          parseInt(prNumber)
        );

        console.log(
          '✅ GraphQL query successful for PR #%s (cost: %s points)',
          prNumber,
          result.rateLimit?.cost || 'unknown'
        );
        return result;
      } catch (error) {
        // Log GraphQL-specific errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('rate limit')) {
          throw new Error(
            `GraphQL rate limit exceeded for ${repository.owner}/${repository.name}#${prNumber}`
          );
        }

        // Sanitize error logging to avoid exposing sensitive information
        const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
        console.warn(`GraphQL failed for PR #${prNumber}, falling back to REST:`, errorType);
        throw error; // This will trigger the fallback to REST version
      }
    });

    // Step 3: Store all data in database using bulk upsert
    const storedData = await step.run('store-all-data', async () => {
      const pullRequest = prData.pullRequest;
      if (!pullRequest) {
        throw new Error(`No PR data returned for #${prNumber}`) as NonRetriableError;
      }

      // First ensure the author exists and get their UUID
      const authorId = await ensureContributorExists(pullRequest.author);
      if (!authorId) {
        throw new Error(`Failed to create/find author for PR #${prNumber}`) as NonRetriableError;
      }

      // Ensure merged_by contributor exists if present
      let mergedById = null;
      if (pullRequest.mergedBy) {
        mergedById = await ensureContributorExists(pullRequest.mergedBy);
      }

      // Store PR details
      const { data: prRecord, error: prError } = await supabase
        .from('pull_requests')
        .upsert(
          {
            repository_id: repositoryId,
            github_id: pullRequest.databaseId,
            number: pullRequest.number,
            title: pullRequest.title,
            body: pullRequest.body,
            state: pullRequest.state?.toLowerCase() === 'open' ? 'open' : 'closed',
            draft: pullRequest.isDraft || false,
            additions: pullRequest.additions || 0,
            deletions: pullRequest.deletions || 0,
            changed_files: pullRequest.changedFiles || 0,
            commits: pullRequest.commits?.totalCount || 0,
            author_id: authorId,
            created_at: pullRequest.createdAt,
            updated_at: pullRequest.updatedAt,
            closed_at: pullRequest.closedAt,
            merged_at: pullRequest.mergedAt,
            merged: pullRequest.merged || false,
            mergeable: getMergeableStatus(pullRequest.mergeable),
            merged_by_id: mergedById,
            base_branch: pullRequest.baseRefName,
            head_branch: pullRequest.headRefName,
          },
          {
            onConflict: 'github_id',
          }
        )
        .select('id')
        .maybeSingle();

      if (prError) {
        throw new Error(`Failed to store PR: ${prError.message}`);
      }

      const prInternalId = prRecord?.id;
      let reviewsStored = 0;
      let commentsStored = 0;

      // Store reviews
      if (pullRequest.reviews?.nodes?.length > 0) {
        // Create all review authors in parallel
        const reviewAuthorPromises = pullRequest.reviews.nodes.map((review: GraphQLReview) =>
          ensureContributorExists(review.author)
        );
        const reviewAuthorIds = await Promise.all(reviewAuthorPromises);

        const reviewsToStore: Array<{
          repository_id: string;
          pull_request_id: string;
          github_id: number;
          state: string;
          body: string;
          author_id: string;
          submitted_at: string;
          commit_id?: string;
        }> = [];
        pullRequest.reviews.nodes.forEach((review: GraphQLReview, index: number) => {
          const reviewAuthorId = reviewAuthorIds[index];
          if (reviewAuthorId) {
            reviewsToStore.push({
              repository_id: repositoryId,
              pull_request_id: prInternalId,
              github_id: review.databaseId,
              state: review.state?.toLowerCase(),
              body: review.body,
              author_id: reviewAuthorId,
              submitted_at: review.submittedAt,
              commit_id: review.commit?.oid,
            });
          }
        });

        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .upsert(reviewsToStore, { onConflict: 'github_id' })
          .select('id');

        if (reviewsError) {
          console.error('Failed to store reviews:', reviewsError);
          throw new Error(`Failed to store reviews: ${reviewsError.message}`);
        }
        reviewsStored = reviews?.length || 0;
      }

      // Store issue comments (general PR comments)
      if (pullRequest.comments?.nodes?.length > 0) {
        // Create all comment authors in parallel
        const commenterPromises = pullRequest.comments.nodes.map((comment: GraphQLComment) =>
          ensureContributorExists(comment.author)
        );
        const commenterIds = await Promise.all(commenterPromises);

        const issueCommentsToStore: Array<{
          repository_id: string;
          pull_request_id: string;
          github_id: number;
          body: string;
          commenter_id: string;
          created_at: string;
          updated_at: string;
          comment_type: 'issue_comment';
        }> = [];
        pullRequest.comments.nodes.forEach((comment: GraphQLComment, index: number) => {
          const commenterId = commenterIds[index];
          if (commenterId) {
            issueCommentsToStore.push({
              repository_id: repositoryId,
              pull_request_id: prInternalId,
              github_id: comment.databaseId,
              body: comment.body,
              commenter_id: commenterId,
              created_at: comment.createdAt,
              updated_at: comment.updatedAt,
              comment_type: 'issue_comment',
            });
          }
        });

        const { data: issueComments, error: issueCommentsError } = await supabase
          .from('comments')
          .upsert(issueCommentsToStore, { onConflict: 'github_id' })
          .select('id');

        if (issueCommentsError) {
          console.error('Failed to store issue comments:', issueCommentsError);
          throw new Error(`Failed to store issue comments: ${issueCommentsError.message}`);
        }
        commentsStored += issueComments?.length || 0;
      }

      // Store review comments (code comments) - extract from reviews
      const reviewCommentsToStore: ReviewComment[] = [];

      if (pullRequest.reviews?.nodes?.length > 0) {
        // Collect all review comment authors for parallel processing
        const allReviewCommentAuthors: Array<{
          comment: GraphQLReviewComment;
          review: GraphQLReview;
        }> = [];

        for (const review of pullRequest.reviews.nodes) {
          if (review.comments?.nodes?.length > 0) {
            for (const comment of review.comments.nodes) {
              allReviewCommentAuthors.push({ comment, review });
            }
          }
        }

        // Create all review comment authors in parallel
        const reviewCommentAuthorPromises = allReviewCommentAuthors.map(({ comment }) =>
          ensureContributorExists(comment.author)
        );
        const reviewCommentAuthorIds = await Promise.all(reviewCommentAuthorPromises);

        // Build review comments with the resolved author IDs
        allReviewCommentAuthors.forEach(({ comment, review }, index) => {
          const commenterId = reviewCommentAuthorIds[index];
          if (commenterId) {
            reviewCommentsToStore.push({
              repository_id: repositoryId,
              pull_request_id: prInternalId,
              github_id: comment.databaseId,
              review_id: review.databaseId,
              body: comment.body,
              path: comment.path,
              position: comment.position,
              original_position: comment.originalPosition,
              commit_id: comment.commit?.oid,
              original_commit_id: comment.originalCommit?.oid,
              diff_hunk: comment.diffHunk,
              commenter_id: commenterId,
              created_at: comment.createdAt,
              updated_at: comment.updatedAt,
              in_reply_to_id: comment.replyTo?.databaseId?.toString(),
              comment_type: 'review_comment',
            });
          }
        });
      }

      if (reviewCommentsToStore.length > 0) {
        const { data: reviewComments, error: reviewCommentsError } = await supabase
          .from('comments')
          .upsert(reviewCommentsToStore, { onConflict: 'github_id' })
          .select('id');

        if (reviewCommentsError) {
          console.error('Failed to store review comments:', reviewCommentsError);
          throw new Error(`Failed to store review comments: ${reviewCommentsError.message}`);
        }
        commentsStored += reviewComments?.length || 0;
      }

      return {
        prStored: true,
        reviewsStored,
        commentsStored,
        totalItems: 1 + reviewsStored + commentsStored,
      };
    });

    return {
      success: true,
      repositoryId,
      prNumber: parseInt(prNumber),
      prId,
      priority,
      method: 'graphql',
      pointsUsed: prData.rateLimit?.cost || 0,
      itemsProcessed: storedData.totalItems,
      breakdown: {
        pr: 1,
        reviews: storedData.reviewsStored,
        comments: storedData.commentsStored,
      },
    };
  }
);
