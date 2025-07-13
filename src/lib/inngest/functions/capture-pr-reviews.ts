import { inngest } from '../client';
import { supabase } from '../../supabase';
import { getOctokit } from '../github-client';
import type { DatabaseReview } from '../types';

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

    // Step 1: Get repository details
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .single();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }
      return data;
    });

    // Step 2: Fetch reviews from GitHub
    const reviews = await step.run("fetch-reviews", async () => {
      const octokit = getOctokit();
      
      try {
        const { data: reviewsData } = await octokit.rest.pulls.listReviews({
          owner: repository.owner,
          repo: repository.name,
          pull_number: parseInt(prNumber),
        });

        // Process each review and ensure reviewers exist in contributors table
        const processedReviews: DatabaseReview[] = [];
        
        for (const review of reviewsData) {
          if (!review.user) continue; // Skip reviews without user data
          
          // Find or create the reviewer in contributors table
          const { data: existingContributor } = await supabase
            .from('contributors')
            .select('id')
            .eq('github_id', review.user.id)
            .single();
          
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
              .single();
              
            if (contributorError) {
              console.warn(`Failed to create reviewer ${review.user.login}:`, contributorError);
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

        return processedReviews;
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          console.warn(`PR #${prNumber} not found, skipping reviews`);
          return [];
        }
        if (apiError.status === 403) {
          throw new Error(`Rate limit exceeded while fetching reviews for PR #${prNumber}. Will retry later.`);
        }
        throw error;
      }
    });

    // Step 3: Store reviews in database
    const storedCount = await step.run("store-reviews", async () => {
      if (reviews.length === 0) {
        return 0;
      }

      // Batch insert reviews
      const { error } = await supabase
        .from('reviews')
        .upsert(reviews, {
          onConflict: 'github_id',
          ignoreDuplicates: false,
        });

      if (error) {
        throw new Error(`Failed to store reviews: ${error.message}`);
      }

      return reviews.length;
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

    return {
      success: true,
      prNumber,
      repositoryId,
      reviewsCount: storedCount,
    };
  }
);