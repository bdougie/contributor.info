import { inngest } from '../client';
import { supabase } from '../../supabase';
import { getOctokit } from '../github-client';
import type { DatabaseReview } from '../types';

export const capturePrReviews = inngest.createFunction(
  {
    id: "capture-pr-reviews",
    name: "Capture PR Reviews",
    concurrency: {
      limit: 10,
      key: "event.data.repositoryId",
    },
    retries: 3,
    throttle: {
      limit: 100,
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

        return reviewsData.map((review: any): DatabaseReview => ({
          github_id: review.id.toString(),
          pull_request_id: prId,
          author_id: review.user?.id.toString(),
          author_username: review.user?.login,
          state: review.state,
          body: review.body || '',
          submitted_at: review.submitted_at,
          commit_id: review.commit_id,
        }));
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          console.warn(`PR #${prNumber} not found, skipping reviews`);
          return [];
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

    // Step 4: Update PR review count
    await step.run("update-pr-stats", async () => {
      const { error } = await supabase
        .from('pull_requests')
        .update({
          review_comments_count: reviews.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prId);

      if (error) {
        console.warn(`Failed to update PR review count: ${error.message}`);
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