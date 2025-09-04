import { inngest } from '../client';
import { supabase } from '../../supabase';
import { getOctokit } from '../github-client';
import { SyncLogger } from '../sync-logger';
import { NonRetriableError } from 'inngest';

// GitHub Issue from API
interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: {
    id: number;
    login: string;
    avatar_url?: string;
    type?: string;
  } | null;
  assignees: unknown[];
  labels: unknown[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  comments: number; // Comment count from API
  pull_request?: unknown; // Will be null for issues, present for PRs
}

/**
 * Captures all issues in a repository and queues individual issue comment capture jobs
 * This function discovers issues and then triggers issue comment collection for each
 */
export const captureRepositoryIssues = inngest.createFunction(
  {
    id: 'capture-repository-issues',
    name: 'Capture Repository Issues',
    concurrency: {
      limit: 2,
      key: 'event.data.repositoryId',
    },
    retries: 2,
    throttle: {
      limit: 20,
      period: '1m',
    },
  },
  { event: 'capture/repository.issues' },
  async ({ event, step }) => {
    const { repositoryId, timeRange = 30 } = event.data;
    const syncLogger = new SyncLogger();
    let apiCallsUsed = 0;

    // Step 0: Initialize sync log
    await step.run('init-sync-log', async () => {
      return await syncLogger.start('repository_issues', repositoryId, {
        timeRange,
        source: 'inngest',
        purpose: 'issue_comment_discovery',
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

    // Step 2: Fetch issues with comments
    const issuesData = await step.run('fetch-issues', async () => {
      const octokit = getOctokit();
      const issues: GitHubIssue[] = [];
      let page = 1;
      let hasMore = true;

      // Calculate date filter for recent issues
      const since = new Date();
      since.setDate(since.getDate() - timeRange);

      try {
        console.log(
          'Fetching issues with comments for %s/%s (last %d days)',
          repository.owner,
          repository.name,
          timeRange
        );

        while (hasMore && page <= 10) {
          // Limit to 10 pages (1000 issues) for safety
          apiCallsUsed++;
          const { data: pageIssues } = await octokit.rest.issues.listForRepo({
            owner: repository.owner,
            repo: repository.name,
            state: 'all', // Get both open and closed issues
            since: since.toISOString(),
            per_page: 100,
            page,
            sort: 'updated',
            direction: 'desc',
          });

          const typedIssues = pageIssues as unknown[];

          // Filter out PRs (GitHub API returns both issues and PRs from issues endpoint)
          // Only include issues that have comments
          const actualIssues = typedIssues.filter(
            (issue: unknown) =>
              !issue.pull_request && // Not a PR
              issue.comments > 0 // Has comments to capture
          ) as GitHubIssue[];

          issues.push(...actualIssues);

          hasMore = typedIssues.length === 100;
          page++;

          console.log(
            'Page %d: Found %d issues with comments (%d total so far)',
            page - 1,
            actualIssues.length,
            issues.length
          );
        }

        await syncLogger.update({
          github_api_calls_used: apiCallsUsed,
          metadata: {
            issuesWithComments: issues.length,
            pagesProcessed: page - 1,
            timeRange,
          },
        });

        return issues;
      } catch (error: unknown) {
        console.error(`Error fetching issues for ${repository.owner}/${repository.name}:`, error);
        const apiError = error as { status?: number };
        if (apiError.status === 404) {
          console.warn(`Repository ${repository.owner}/${repository.name} not found, skipping`);
          return [];
        }
        if (apiError.status === 403) {
          throw new Error(`Rate limit exceeded while fetching issues. Will retry later.`);
        }
        throw error;
      }
    });

    // Step 3: Store/update issues in database and queue comment capture jobs
    const processedCount = await step.run('process-issues', async () => {
      if (issuesData.length === 0) {
        return 0;
      }

      const issueCommentJobs = [];

      for (const issue of issuesData) {
        if (!issue.user) continue;

        // Get or create issue author
        let authorId: string | null = null;
        const { data: existingContributor } = await supabase
          .from('contributors')
          .select('id')
          .eq('github_id', issue.user.id)
          .maybeSingle();

        if (existingContributor) {
          authorId = existingContributor.id;
        } else {
          const { data: newContributor } = await supabase
            .from('contributors')
            .insert({
              github_id: issue.user.id,
              username: issue.user.login,
              avatar_url: issue.user.avatar_url,
              is_bot: issue.user.type === 'Bot' || issue.user.login.includes('[bot]'),
            })
            .select('id')
            .maybeSingle();

          authorId = newContributor?.id || null;
        }

        // Upsert issue in database
        const { data: upsertedIssue, error } = await supabase
          .from('issues')
          .upsert({
            github_id: issue.id,
            repository_id: repositoryId,
            number: issue.number,
            title: issue.title,
            body: issue.body,
            state: issue.state,
            author_id: authorId,
            assignees: issue.assignees,
            labels: issue.labels,
            comments_count: issue.comments,
            created_at: issue.created_at,
            updated_at: issue.updated_at,
            closed_at: issue.closed_at,
          })
          .select('id')
          .maybeSingle();

        if (error) {
          console.warn(`Failed to upsert issue #${issue.number}:`, error.message);
          continue;
        }

        // Queue issue comment capture job
        issueCommentJobs.push({
          issueId: upsertedIssue.id,
          issueNumber: issue.number,
          commentCount: issue.comments,
        });
      }

      // Queue all issue comment capture jobs
      for (const job of issueCommentJobs) {
        await inngest.send({
          name: 'capture/issue.comments',
          data: {
            repositoryId,
            issueNumber: job.issueNumber.toString(),
            issueId: job.issueId,
            priority: 'medium',
          },
        });
      }

      console.log(`Queued ${issueCommentJobs.length} issue comment capture jobs`);
      return issueCommentJobs.length;
    });

    // Complete sync log
    await step.run('complete-sync-log', async () => {
      await syncLogger.complete({
        records_processed: issuesData.length,
        records_inserted: processedCount,
        github_api_calls_used: apiCallsUsed,
        metadata: {
          issuesWithComments: issuesData.length,
          issueCommentJobsQueued: processedCount,
          timeRange,
        },
      });
    });

    return {
      success: true,
      repositoryId,
      issuesProcessed: issuesData.length,
      commentJobsQueued: processedCount,
    };
  }
);
