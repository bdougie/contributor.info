import { inngest } from '../client';
import { supabase } from '../../supabase';
import { GraphQLClient } from '../graphql-client';
import type { NonRetriableError } from 'inngest';

// GraphQL client instance
const graphqlClient = new GraphQLClient();

// Helper function to ensure contributors exist and return their UUIDs
async function ensureContributorExists(githubUser: any): Promise<string | null> {
  if (!githubUser) {
    console.log('ensureContributorExists: githubUser is null/undefined');
    return null;
  }

  if (!githubUser.databaseId) {
    console.log('ensureContributorExists: githubUser.databaseId is missing', {
      login: githubUser.login,
      keys: Object.keys(githubUser)
    });
    return null;
  }

  if (!githubUser.login) {
    console.log('ensureContributorExists: githubUser.login is missing', {
      databaseId: githubUser.databaseId,
      keys: Object.keys(githubUser)
    });
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('contributors')
      .upsert({
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
      }, {
        onConflict: 'github_id',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error upserting contributor:', error, {
        githubUser: {
          databaseId: githubUser.databaseId,
          login: githubUser.login,
          name: githubUser.name,
          email: githubUser.email,
          avatarUrl: githubUser.avatarUrl
        }
      });
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('Exception in ensureContributorExists:', err, {
      githubUser: {
        databaseId: githubUser.databaseId,
        login: githubUser.login,
        keys: Object.keys(githubUser)
      }
    });
    return null;
  }
}

export const capturePrDetailsGraphQL = inngest.createFunction(
  {
    id: "capture-pr-details-graphql",
    name: "Capture PR Details (GraphQL)",
    concurrency: {
      limit: 10, // Can increase due to better rate limits
      key: "event.data.repositoryId",
    },
    throttle: { limit: 50, period: "1m" }, // More generous than REST
    retries: 2,
  },
  { event: "capture/pr.details.graphql" },
  async ({ event, step }) => {
    const { repositoryId, prNumber, prId, priority } = event.data;

    // Step 1: Get repository details
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .single();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`) as NonRetriableError;
      }

      return data;
    });

    // Step 2: Fetch comprehensive PR data with GraphQL
    const prData = await step.run("fetch-pr-all-data", async () => {
      try {
        const result = await graphqlClient.getPRDetails(
          repository.owner,
          repository.name,
          parseInt(prNumber)
        );
        
        console.log(`✅ GraphQL query successful for PR #${prNumber} (cost: ${result.rateLimit?.cost || 'unknown'} points)`);
        return result;
      } catch (error: any) {
        // Log GraphQL-specific errors
        if (error.message?.includes('rate limit')) {
          throw new Error(`GraphQL rate limit exceeded for ${repository.owner}/${repository.name}#${prNumber}`);
        }
        
        console.warn(`GraphQL failed for PR #${prNumber}, falling back to REST:`, error.message);
        throw error; // This will trigger the fallback to REST version
      }
    });

    // Step 3: Store all data in database using bulk upsert
    const storedData = await step.run("store-all-data", async () => {
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
        .upsert({
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
          mergeable: pullRequest.mergeable === 'MERGEABLE' ? true : pullRequest.mergeable === 'CONFLICTING' ? false : null,
          merged_by_id: mergedById,
          base_branch: pullRequest.baseRefName,
          head_branch: pullRequest.headRefName,
        }, {
          onConflict: 'github_id'
        })
        .select('id')
        .single();

      if (prError) {
        throw new Error(`Failed to store PR: ${prError.message}`);
      }

      const prInternalId = prRecord?.id;
      let reviewsStored = 0;
      let commentsStored = 0;

      // Store reviews
      if (pullRequest.reviews?.nodes?.length > 0) {
        const reviewsToStore = [];
        
        for (const review of pullRequest.reviews.nodes) {
          const reviewAuthorId = await ensureContributorExists(review.author);
          if (reviewAuthorId) {
            reviewsToStore.push({
              repository_id: repositoryId,
              pull_request_id: prInternalId,
              github_id: review.databaseId,
              pull_request_number: pullRequest.number,
              state: review.state?.toLowerCase(),
              body: review.body,
              author_id: reviewAuthorId,
              submitted_at: review.submittedAt,
              commit_id: review.commit?.oid,
            });
          }
        }

        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .upsert(reviewsToStore, { onConflict: 'github_id' })
          .select('id');

        if (!reviewsError) {
          reviewsStored = reviews?.length || 0;
        }
      }

      // Store issue comments (general PR comments)
      if (pullRequest.comments?.nodes?.length > 0) {
        const issueCommentsToStore = [];
        
        for (const comment of pullRequest.comments.nodes) {
          const commenterId = await ensureContributorExists(comment.author);
          if (commenterId) {
            issueCommentsToStore.push({
              repository_id: repositoryId,
              pull_request_id: prInternalId,
              github_id: comment.databaseId,
              pull_request_number: pullRequest.number,
              body: comment.body,
              commenter_id: commenterId,
              created_at: comment.createdAt,
              updated_at: comment.updatedAt,
              comment_type: 'issue_comment'
            });
          }
        }

        const { data: issueComments, error: issueCommentsError } = await supabase
          .from('comments')
          .upsert(issueCommentsToStore, { onConflict: 'github_id' })
          .select('id');

        if (!issueCommentsError) {
          commentsStored += issueComments?.length || 0;
        }
      }

      // Store review comments (code comments) - extract from reviews
      const reviewCommentsToStore: any[] = [];
      
      if (pullRequest.reviews?.nodes?.length > 0) {
        for (const review of pullRequest.reviews.nodes) {
          if (review.comments?.nodes?.length > 0) {
            for (const comment of review.comments.nodes) {
              const commenterId = await ensureContributorExists(comment.author);
              if (commenterId) {
                reviewCommentsToStore.push({
                  repository_id: repositoryId,
                  pull_request_id: prInternalId,
                  github_id: comment.databaseId,
                  pull_request_number: pullRequest.number,
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
                  comment_type: 'review_comment'
                });
              }
            }
          }
        }
      }
      
      if (reviewCommentsToStore.length > 0) {
        const { data: reviewComments, error: reviewCommentsError } = await supabase
          .from('comments')
          .upsert(reviewCommentsToStore, { onConflict: 'github_id' })
          .select('id');

        if (!reviewCommentsError) {
          commentsStored += reviewComments?.length || 0;
        }
      }

      return {
        prStored: true,
        reviewsStored,
        commentsStored,
        totalItems: 1 + reviewsStored + commentsStored
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
        comments: storedData.commentsStored
      }
    };
  }
);