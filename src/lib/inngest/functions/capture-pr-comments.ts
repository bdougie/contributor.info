import { inngest } from '../client';
import { supabase } from '../../supabase';
import { getOctokit } from '../github-client';
import type { DatabaseComment } from '../types';

export const capturePrComments = inngest.createFunction(
  {
    id: "capture-pr-comments",
    name: "Capture PR Comments",
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
  { event: "capture/pr.comments" },
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

    // Step 2: Fetch both PR comments and issue comments
    const commentsData = await step.run("fetch-comments", async () => {
      const octokit = getOctokit();
      
      try {
        // Fetch PR review comments
        const { data: prCommentsData } = await octokit.rest.pulls.listComments({
          owner: repository.owner,
          repo: repository.name,
          pull_number: parseInt(prNumber),
        });

        // Fetch issue comments (general PR comments)
        const { data: issueCommentsData } = await octokit.rest.issues.listComments({
          owner: repository.owner,
          repo: repository.name,
          issue_number: parseInt(prNumber),
        });

        return {
          prComments: prCommentsData.map((comment: any): DatabaseComment => ({
            github_id: comment.id.toString(),
            pull_request_id: prId,
            author_id: comment.user?.id.toString(),
            author_username: comment.user?.login,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            in_reply_to_id: comment.in_reply_to_id?.toString(),
            path: comment.path,
            line: comment.line,
            commit_id: comment.commit_id,
            comment_type: 'review' as const,
          })),
          issueComments: issueCommentsData.map((comment: any): DatabaseComment => ({
            github_id: comment.id.toString(),
            pull_request_id: prId,
            author_id: comment.user?.id.toString(),
            author_username: comment.user?.login,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            comment_type: 'issue' as const,
          })),
        };
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          console.warn(`PR #${prNumber} not found, skipping comments`);
          return { prComments: [], issueComments: [] };
        }
        throw error;
      }
    });

    // Step 3: Store comments in database
    const storedCount = await step.run("store-comments", async () => {
      const allComments = [...commentsData.prComments, ...commentsData.issueComments];
      
      if (allComments.length === 0) {
        return 0;
      }

      // Batch insert comments
      const { error } = await supabase
        .from('comments')
        .upsert(allComments, {
          onConflict: 'github_id',
          ignoreDuplicates: false,
        });

      if (error) {
        throw new Error(`Failed to store comments: ${error.message}`);
      }

      return allComments.length;
    });

    // Step 4: Update PR comment count
    await step.run("update-pr-stats", async () => {
      const { error } = await supabase
        .from('pull_requests')
        .update({
          comments_count: commentsData.issueComments.length,
          review_comments_count: commentsData.prComments.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', prId);

      if (error) {
        console.warn(`Failed to update PR comment counts: ${error.message}`);
      }
    });

    return {
      success: true,
      prNumber,
      repositoryId,
      reviewCommentsCount: commentsData.prComments.length,
      issueCommentsCount: commentsData.issueComments.length,
      totalCommentsCount: storedCount,
    };
  }
);