import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { getOctokit } from '../github-client';
import type { DatabaseComment } from '../types';
import { SyncLogger } from '../sync-logger';
import { NonRetriableError } from 'inngest';
import { detectBot } from '../../utils/bot-detection';

// GitHub Issue Comment from API
interface GitHubIssueComment {
  id: number;
  user: {
    id: number;
    login: string;
    avatar_url?: string;
    type?: string;
  } | null;
  body: string;
  created_at: string;
  updated_at: string;
}

/**
 * Captures issue comments using GitHub REST API
 * This is specifically for GitHub issues (not PRs), extending
 * triager and first responder metrics to include issue activity
 *
 * Note: Processes individual issues only. Repository-wide fetching
 * was removed due to memory/performance concerns for large repos.
 */
export const captureIssueComments = inngest.createFunction(
  {
    id: 'capture-issue-comments',
    name: 'Capture Issue Comments',
    concurrency: {
      limit: 3,
      key: 'event.data.repositoryId',
    },
    retries: 2,
    throttle: {
      limit: 30,
      period: '1m',
    },
  },
  { event: 'capture/issue.comments' },
  async ({ event, step }) => {
    const { repositoryId, issueNumber, issueId } = event.data;
    const syncLogger = new SyncLogger();
    let apiCallsUsed = 0;

    // Validate required parameters
    if (!repositoryId) {
      throw new NonRetriableError('Missing repositoryId parameter');
    }
    if (!issueNumber) {
      throw new NonRetriableError('Missing issueNumber parameter');
    }
    if (!issueId) {
      throw new NonRetriableError('Missing issueId parameter');
    }

    // Step 0: Initialize sync log
    await step.run('init-sync-log', async () => {
      return await syncLogger.start('issue_comments', repositoryId, {
        issueNumber: issueNumber,
        issueId: issueId,
        source: 'inngest',
      });
    });

    // Step 1: Get repository details
    const repository = await step.run('get-repository', async () => {
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

    // Step 2: Fetch issue comments
    const commentsData = await step.run('fetch-comments', async () => {
      const octokit = getOctokit();

      try {
        console.log(
          'Fetching comments for issue #%s in %s/%s',
          issueNumber,
          repository.owner,
          repository.name
        );

        // Fetch issue comments
        apiCallsUsed++;
        const { data: issueCommentsData } = await octokit.rest.issues.listComments({
          owner: repository.owner,
          repo: repository.name,
          issue_number: parseInt(issueNumber),
        });

        // Process comments and ensure commenters exist in contributors table
        const processedComments: DatabaseComment[] = [];
        let failedContributorCreations = 0;

        for (const comment of issueCommentsData as GitHubIssueComment[]) {
          if (!comment.user) continue;

          // Find or create the commenter in contributors table using upsert for race condition safety
          const { data: contributor, error: contributorError } = await supabase
            .from('contributors')
            .upsert(
              {
                github_id: comment.user.id,
                username: comment.user.login,
                avatar_url: comment.user.avatar_url,
                is_bot: detectBot({ githubUser: comment.user }).isBot,
              },
              {
                onConflict: 'github_id',
                ignoreDuplicates: false,
              }
            )
            .select('id')
            .maybeSingle();

          if (contributorError || !contributor) {
            console.warn(
              `Failed to upsert commenter ${comment.user.login}:`,
              contributorError?.message || 'Unknown error'
            );
            failedContributorCreations++;
            continue;
          }

          const commenterId = contributor.id;

          processedComments.push({
            github_id: comment.id.toString(),
            repository_id: repositoryId,
            issue_id: issueId, // This is the key difference - issue_id instead of pull_request_id
            commenter_id: commenterId,
            body: comment.body,
            created_at: comment.created_at,
            updated_at: comment.updated_at,
            comment_type: 'issue_comment', // Actual issue comment, not PR issue comment
          });
        }

        console.log('Found %s issue comments', processedComments.length);

        await syncLogger.update({
          github_api_calls_used: apiCallsUsed,
          metadata: {
            issueCommentsFound: processedComments.length,
            failedContributorCreations: failedContributorCreations,
          },
        });

        return {
          comments: processedComments,
          failedContributorCreations: failedContributorCreations,
        };
      } catch (error: unknown) {
        console.error('Error fetching comments for issue #%s:', issueNumber, error);
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          console.warn('Issue #%s not found, skipping comments', issueNumber);
          return { comments: [], failedContributorCreations: 0 };
        }
        if (apiError.status === 403) {
          throw new Error(
            `Rate limit exceeded while fetching comments for issue #${issueNumber}. Will retry later.`
          );
        }
        throw error;
      }
    });

    // Step 3: Store comments in database
    const storedCount = await step.run('store-comments', async () => {
      const { comments } = commentsData;

      if (comments.length === 0) {
        return 0;
      }

      // Batch insert comments
      const { error } = await supabase.from('comments').upsert(comments, {
        onConflict: 'github_id',
        ignoreDuplicates: false,
      });

      if (error) {
        await syncLogger.fail(`Failed to store comments: ${error.message}`, {
          records_processed: comments.length,
          records_failed: comments.length,
          github_api_calls_used: apiCallsUsed,
        });
        throw new Error(`Failed to store comments: ${error.message}`);
      }

      return comments.length;
    });

    // Step 4: Update issue timestamp
    await step.run('update-issue-stats', async () => {
      const { error } = await supabase
        .from('issues')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', issueId);

      if (error) {
        console.warn('Failed to update issue timestamp: %s', error.message);
      }
    });

    // Complete sync log
    await step.run('complete-sync-log', async () => {
      await syncLogger.complete({
        records_processed: storedCount,
        records_inserted: storedCount,
        github_api_calls_used: apiCallsUsed,
        metadata: {
          issueCommentsCount: commentsData.comments.length,
          totalCommentsCount: storedCount,
          failedContributorCreations: commentsData.failedContributorCreations,
        },
      });
    });

    return {
      success: true,
      issueNumber,
      repositoryId,
      issueCommentsCount: storedCount,
    };
  }
);
