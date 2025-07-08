import { inngest } from '../client';
import { supabase } from '../../supabase';
import { getOctokit } from '../github-client';
import type { DatabaseComment } from '../types';

export const capturePrComments = inngest.createFunction(
  {
    id: "capture-pr-comments",
    name: "Capture PR Comments",
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

        // Process comments and ensure commenters exist in contributors table
        const processedPrComments: DatabaseComment[] = [];
        const processedIssueComments: DatabaseComment[] = [];
        
        for (const comment of prCommentsData) {
          if (!comment.user) continue;
          
          // Find or create the commenter in contributors table
          const { data: existingContributor } = await supabase
            .from('contributors')
            .select('id')
            .eq('github_id', comment.user.id)
            .single();
          
          let commenterId = existingContributor?.id;
          
          if (!commenterId) {
            // Create new contributor
            const { data: newContributor, error: contributorError } = await supabase
              .from('contributors')
              .insert({
                github_id: comment.user.id,
                username: comment.user.login,
                avatar_url: comment.user.avatar_url,
                is_bot: comment.user.type === 'Bot' || comment.user.login.includes('[bot]')
              })
              .select('id')
              .single();
              
            if (contributorError) {
              console.warn(`Failed to create commenter ${comment.user.login}:`, contributorError);
              continue;
            }
            
            commenterId = newContributor.id;
          }
          
          processedPrComments.push({
            github_id: comment.id.toString(),
            pull_request_id: prId,
            commenter_id: commenterId,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            comment_type: 'review_comment',
            in_reply_to_id: comment.in_reply_to_id?.toString(),
            position: comment.position,
            original_position: comment.original_position,
            diff_hunk: comment.diff_hunk,
            path: comment.path,
            commit_id: comment.commit_id,
          });
        }
        
        for (const comment of issueCommentsData) {
          if (!comment.user) continue;
          
          // Find or create the commenter in contributors table
          const { data: existingContributor } = await supabase
            .from('contributors')
            .select('id')
            .eq('github_id', comment.user.id)
            .single();
          
          let commenterId = existingContributor?.id;
          
          if (!commenterId) {
            // Create new contributor
            const { data: newContributor, error: contributorError } = await supabase
              .from('contributors')
              .insert({
                github_id: comment.user.id,
                username: comment.user.login,
                avatar_url: comment.user.avatar_url,
                is_bot: comment.user.type === 'Bot' || comment.user.login.includes('[bot]')
              })
              .select('id')
              .single();
              
            if (contributorError) {
              console.warn(`Failed to create commenter ${comment.user.login}:`, contributorError);
              continue;
            }
            
            commenterId = newContributor.id;
          }
          
          processedIssueComments.push({
            github_id: comment.id.toString(),
            pull_request_id: prId,
            commenter_id: commenterId,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            comment_type: 'issue_comment',
          });
        }

        return {
          prComments: processedPrComments,
          issueComments: processedIssueComments,
        };
      } catch (error: unknown) {
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          console.warn(`PR #${prNumber} not found, skipping comments`);
          return { prComments: [], issueComments: [] };
        }
        if (apiError.status === 403) {
          throw new Error(`Rate limit exceeded while fetching comments for PR #${prNumber}. Will retry later.`);
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

    // Step 4: Update PR timestamp (comment counts are tracked via foreign key relationships)
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
      reviewCommentsCount: commentsData.prComments.length,
      issueCommentsCount: commentsData.issueComments.length,
      totalCommentsCount: storedCount,
    };
  }
);