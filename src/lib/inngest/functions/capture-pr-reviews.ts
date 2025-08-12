import { inngest } from '../client';
import { supabase } from '../../supabase';
import { getOctokit } from '../github-client';
import type { DatabaseReview } from '../types';
import { SyncLogger } from '../sync-logger';
import { NonRetriableError } from 'inngest';

// Extended GitHub Review type with user details
interface GitHubReviewWithUser {
  id: number;
  user: {
    id: number;
    login: string;
    avatar_url?: string;
    type?: string;
  } | null;
  state: string;
  body: string;
  submitted_at: string;
  commit_id: string;
}

/**
 * Captures PR reviews using GitHub REST API
 * 
 * Note: This function intentionally uses REST API instead of GraphQL because:
 * 1. Reviews have simpler pagination patterns with REST
 * 2. Performance is acceptable with current rate limits
 * 3. REST provides more predictable response structure for reviews
 * 
 * For GraphQL implementation details, see the hybrid client at:
 * scripts/progressive-capture/lib/hybrid-github-client.js
 */
export const capturePrReviews = inngest.createFunction(
  {
    id: "capture-pr-reviews",
    name: "Capture PR Reviews",
    concurrency: {
      limit: 3,
      key: "event.data.repositoryId",
    },
    retries: 2,
    throttle: {
      limit: 30,
      period: "1m",
    },
  },
  { event: "capture/pr.reviews" },
  async ({ event, step }) => {
    const { repositoryId, prNumber, prId } = event.data;
    const syncLogger = new SyncLogger();
    let apiCallsUsed = 0;

    // Step 0: Initialize sync log
    await step.run("init-sync-log", async () => {
      return await syncLogger.start('pr_reviews', repositoryId, {
        prNumber,
        prId,
        source: 'inngest'
      });
    });

    // Step 1: Get repository details
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .maybeSingle();

      if (error || !data) {
        throw new NonRetriableError(`Repository not found: ${repositoryId}`);
      }
      return data;
    });

    // Step 2: Fetch reviews from GitHub
    const reviews = await step.run("fetch-reviews", async () => {
      const octokit = getOctokit();
      
      try {
        console.log(`Fetching reviews for PR #${prNumber} in ${repository.owner}/${repository.name}`);
        apiCallsUsed++;
        const { data: reviewsData } = await octokit.rest.pulls.listReviews({
          owner: repository.owner,
          repo: repository.name,
          pull_number: parseInt(prNumber),
        });

        // Process each review and ensure reviewers exist in contributors table
        const processedReviews: DatabaseReview[] = [];
        let failedContributorCreations = 0;
        
        for (const review of reviewsData as GitHubReviewWithUser[]) {
          if (!review.user) continue; // Skip reviews without user data
          
          // Find or create the reviewer in contributors table
          const { data: existingContributor } = await supabase
            .from('contributors')
            .select('id')
            .eq('github_id', review.user.id)
            .maybeSingle();
          
          let reviewerId = existingContributor?.id;
          
          if (!reviewerId) {
            // Create new contributor
            const { data: newContributor, error: contributorError } = await supabase
              .from('contributors')
              .insert({
                github_id: review.user.id,
                username: review.user.login,
                avatar_url: review.user.avatar_url,
                is_bot: review.user.type === 'Bot' || review.user.login.includes('[bot]')
              })
              .select('id')
              .maybeSingle();
              
            if (contributorError || !newContributor) {
              console.warn(`Failed to create reviewer ${review.user.login}:`, contributorError?.message || 'Unknown error');
              failedContributorCreations++;
              continue;
            }
            
            reviewerId = newContributor.id;
          }
          
          processedReviews.push({
            github_id: review.id.toString(),
            pull_request_id: prId,
            reviewer_id: reviewerId,
            state: review.state,
            body: review.body || '',
            submitted_at: review.submitted_at,
            commit_id: review.commit_id,
          });
        }

        console.log(`Found ${(reviewsData as GitHubReviewWithUser[]).length} reviews for PR #${prNumber}`);
        
        await syncLogger.update({
          github_api_calls_used: apiCallsUsed,
          metadata: {
            reviewsFound: (reviewsData as GitHubReviewWithUser[]).length,
            reviewsWithUsers: processedReviews.length,
            failedContributorCreations: failedContributorCreations
          }
        });

        return { reviews: processedReviews, failedContributorCreations };
      } catch (error: unknown) {
        console.error(`Error fetching reviews for PR #${prNumber}:`, error);
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          console.warn(`PR #${prNumber} not found, skipping reviews`);
          return { reviews: [], failedContributorCreations: 0 };
        }
        if (apiError.status === 403) {
          throw new Error(`Rate limit exceeded while fetching reviews for PR #${prNumber}. Will retry later.`);
        }
        throw error;
      }
    });

    // Step 3: Store reviews in database
    const storedCount = await step.run("store-reviews", async () => {
      if (reviews.reviews.length === 0) {
        return 0;
      }

      // Batch insert reviews
      const { error } = await supabase
        .from('reviews')
        .upsert(reviews.reviews, {
          onConflict: 'github_id',
          ignoreDuplicates: false,
        });

      if (error) {
        await syncLogger.fail(`Failed to store reviews: ${error.message}`, {
          records_processed: reviews.reviews.length,
          records_failed: reviews.reviews.length,
          github_api_calls_used: apiCallsUsed
        });
        throw new Error(`Failed to store reviews: ${error.message}`);
      }

      return reviews.reviews.length;
    });

    // Step 4: Update PR timestamp (review counts are tracked via foreign key relationships)
    await step.run("update-pr-stats", async () => {
      const { error } = await supabase
        .from('pull_requests')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', prId);

      if (error) {
        console.warn(`Failed to update PR timestamp: ${error.message}`);
      }
    });

    // Complete sync log
    await step.run("complete-sync-log", async () => {
      await syncLogger.complete({
        records_processed: storedCount,
        records_inserted: storedCount,
        github_api_calls_used: apiCallsUsed,
        metadata: {
          reviewsCount: storedCount,
          failedContributorCreations: reviews.failedContributorCreations
        }
      });
    });

    return {
      success: true,
      prNumber,
      repositoryId,
      reviewsCount: storedCount,
    };
  }
);