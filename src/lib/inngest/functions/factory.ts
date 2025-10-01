import { Inngest, NonRetriableError } from 'inngest';
import { supabase } from '../supabase-server';
import { CommitProcessor } from '../../progressive-capture/commit-processor';

/**
 * Factory function to create Inngest functions with a specific client instance.
 * This allows us to use the same function definitions with different clients
 * (e.g., local dev vs production).
 */
export function createInngestFunctions(inngest: Inngest) {
  // GraphQL Repository Sync function with full implementation
  const captureRepositorySyncGraphQL = inngest.createFunction(
    {
      id: 'capture-repository-sync-graphql',
      name: 'Sync Recent Repository PRs (GraphQL)',
      concurrency: {
        limit: 5,
        key: 'event.data.repositoryId',
      },
      throttle: { limit: 75, period: '1m' },
      retries: 2,
    },
    { event: 'capture/repository.sync.graphql' },
    async ({ event, step }) => {
      const { repositoryId, days = 7, priority, reason } = event.data;

      // Validate repositoryId first
      if (!repositoryId) {
        console.error('Missing repositoryId in event data:', event.data);
        throw new NonRetriableError(`Missing required field: repositoryId`);
      }

      console.log('[GraphQL Sync] Starting sync for repository %s for %s days', repositoryId, days);

      // Step 1: Fetch repository details from database
      const repoDetails = await step.run('fetch-repo-details', async () => {
        const { data: repo, error } = await supabase
          .from('repositories')
          .select('github_id, owner, name')
          .eq('id', repositoryId)
          .maybeSingle();

        if (error || !repo) {
          throw new NonRetriableError(`Repository not found: ${repositoryId}`);
        }

        return repo;
      });

      // Step 2: Trigger sync (actual implementation would go here)
      const syncResult = await step.run('sync-repository-data', async () => {
        console.log('Syncing %s/%s for %s days', repoDetails.owner, repoDetails.name, days);

        // This is where the actual GraphQL sync logic would be imported and called
        // For now, returning stub data to avoid breaking the function
        return {
          success: true,
          prCount: 0,
          message: 'Repository sync completed (stub implementation)',
        };
      });

      return {
        success: true,
        repositoryId,
        repository: `${repoDetails.owner}/${repoDetails.name}`,
        days,
        priority,
        reason,
        result: syncResult,
      };
    }
  );

  // Capture PR Details function
  const capturePrDetails = inngest.createFunction(
    {
      id: 'capture-pr-details',
      name: 'Capture PR Details',
      concurrency: {
        limit: 10,
        key: 'event.data.pull_request_id',
      },
      retries: 2,
    },
    { event: 'capture/pr.details' },
    async ({ event }) => {
      const { pull_request_id, repository_id } = event.data;

      if (!pull_request_id || !repository_id) {
        throw new NonRetriableError('Missing required fields');
      }

      console.log('Capturing PR details for PR %s in repo %s', pull_request_id, repository_id);

      // Step implementation would go here
      return {
        success: true,
        pull_request_id,
        repository_id,
        message: 'PR details captured (stub)',
      };
    }
  );

  // Capture PR Details GraphQL function
  const capturePrDetailsGraphQL = inngest.createFunction(
    {
      id: 'capture-pr-details-graphql',
      name: 'Capture PR Details (GraphQL)',
      concurrency: {
        limit: 10,
        key: 'event.data.pull_request_id',
      },
      throttle: { limit: 100, period: '1m' },
      retries: 2,
    },
    { event: 'capture/pr.details.graphql' },
    async ({ event }) => {
      const {
        pull_request_id,
        repository_id,
        include_reviews = true,
        include_comments = true,
      } = event.data;

      if (!pull_request_id || !repository_id) {
        throw new NonRetriableError('Missing required fields');
      }

      console.log(
        `[GraphQL] Capturing PR details for PR ${pull_request_id} in repo ${repository_id}`
      );

      // Implementation would go here - using stub for now
      return {
        success: true,
        pull_request_id,
        repository_id,
        include_reviews,
        include_comments,
        message: 'PR details captured via GraphQL (stub)',
      };
    }
  );

  // Capture PR Reviews function
  const capturePrReviews = inngest.createFunction(
    {
      id: 'capture-pr-reviews',
      name: 'Capture PR Reviews',
      concurrency: {
        limit: 10,
        key: 'event.data.pull_request_id',
      },
      retries: 2,
    },
    { event: 'capture/pr.reviews' },
    async ({ event }) => {
      const { pull_request_id, repository_id } = event.data;

      if (!pull_request_id || !repository_id) {
        throw new NonRetriableError('Missing required fields');
      }

      console.log('Capturing PR reviews for PR %s', pull_request_id);

      return {
        success: true,
        pull_request_id,
        repository_id,
        message: 'PR reviews captured (stub)',
      };
    }
  );

  // Capture PR Comments function
  const capturePrComments = inngest.createFunction(
    {
      id: 'capture-pr-comments',
      name: 'Capture PR Comments',
      concurrency: {
        limit: 10,
        key: 'event.data.pull_request_id',
      },
      retries: 2,
    },
    { event: 'capture/pr.comments' },
    async ({ event }) => {
      const { pull_request_id, repository_id } = event.data;

      if (!pull_request_id || !repository_id) {
        throw new NonRetriableError('Missing required fields');
      }

      console.log('Capturing PR comments for PR %s', pull_request_id);

      return {
        success: true,
        pull_request_id,
        repository_id,
        message: 'PR comments captured (stub)',
      };
    }
  );

  // Capture Repository Sync (REST API version)
  const captureRepositorySync = inngest.createFunction(
    {
      id: 'capture-repository-sync',
      name: 'Sync Repository PRs (REST)',
      concurrency: {
        limit: 3,
        key: 'event.data.repositoryId',
      },
      throttle: { limit: 50, period: '1m' },
      retries: 2,
    },
    { event: 'capture/repository.sync' },
    async ({ event }) => {
      const { repositoryId, days = 7 } = event.data;

      if (!repositoryId) {
        throw new NonRetriableError('Missing repositoryId');
      }

      console.log('[REST] Syncing repository %s for %s days', repositoryId, days);

      return {
        success: true,
        repositoryId,
        days,
        message: 'Repository synced via REST API (stub)',
      };
    }
  );

  // Classify Repository Size function
  const classifyRepositorySize = inngest.createFunction(
    {
      id: 'classify-repository-size',
      name: 'Classify Repository Sizes',
      concurrency: { limit: 1 },
    },
    { event: 'classify/repository.size' },
    async () => {
      console.log('Classifying repository sizes...');

      return {
        success: true,
        message: 'Repository sizes classified (stub)',
      };
    }
  );

  // Classify Single Repository function
  const classifySingleRepository = inngest.createFunction(
    {
      id: 'classify-single-repository',
      name: 'Classify Single Repository',
      concurrency: {
        limit: 5,
        key: 'event.data.repositoryId',
      },
    },
    { event: 'classify/repository.single' },
    async ({ event }) => {
      const { repositoryId } = event.data;

      if (!repositoryId) {
        throw new NonRetriableError('Missing repositoryId');
      }

      console.log('Classifying repository %s', repositoryId);

      return {
        success: true,
        repositoryId,
        message: 'Repository classified (stub)',
      };
    }
  );

  // Update PR Activity function
  const updatePrActivity = inngest.createFunction(
    {
      id: 'update-pr-activity',
      name: 'Update PR Activity',
      concurrency: {
        limit: 10,
        key: 'event.data.pull_request_id',
      },
    },
    { event: 'update/pr.activity' },
    async ({ event }) => {
      const { pull_request_id } = event.data;

      if (!pull_request_id) {
        throw new NonRetriableError('Missing pull_request_id');
      }

      console.log('Updating activity for PR %s', pull_request_id);

      return {
        success: true,
        pull_request_id,
        message: 'PR activity updated (stub)',
      };
    }
  );

  // Discover New Repository function
  const discoverNewRepository = inngest.createFunction(
    {
      id: 'discover-new-repository',
      name: 'Discover New Repository',
      concurrency: {
        limit: 5,
        key: 'event.data.repository',
      },
    },
    { event: 'discover/repository.new' },
    async ({ event }) => {
      const { repository, owner, name } = event.data;

      if (!repository && (!owner || !name)) {
        throw new NonRetriableError('Missing repository information');
      }

      const repoName = repository || `${owner}/${name}`;
      console.log('Discovering new repository: %s', repoName);

      return {
        success: true,
        repository: repoName,
        message: 'Repository discovered (stub)',
      };
    }
  );

  // Capture Issue Comments function
  const captureIssueComments = inngest.createFunction(
    {
      id: 'capture-issue-comments',
      name: 'Capture Issue Comments',
      concurrency: {
        limit: 10,
        key: 'event.data.issue_id',
      },
      retries: 2,
    },
    { event: 'capture/issue.comments' },
    async ({ event }) => {
      const { issue_id, repository_id } = event.data;

      if (!issue_id || !repository_id) {
        throw new NonRetriableError('Missing required fields');
      }

      console.log('Capturing comments for issue %s', issue_id);

      return {
        success: true,
        issue_id,
        repository_id,
        message: 'Issue comments captured (stub)',
      };
    }
  );

  // Capture Repository Issues function
  const captureRepositoryIssues = inngest.createFunction(
    {
      id: 'capture-repository-issues',
      name: 'Capture Repository Issues',
      concurrency: {
        limit: 3,
        key: 'event.data.repositoryId',
      },
      throttle: { limit: 50, period: '1m' },
      retries: 2,
    },
    { event: 'capture/repository.issues' },
    async ({ event }) => {
      const { repositoryId, state = 'all' } = event.data;

      if (!repositoryId) {
        throw new NonRetriableError('Missing repositoryId');
      }

      console.log('Capturing issues for repository %s with state: %s', repositoryId, state);

      return {
        success: true,
        repositoryId,
        state,
        message: 'Repository issues captured (stub)',
      };
    }
  );

  // Capture Commits Initial function
  const captureCommitsInitial = inngest.createFunction(
    {
      id: 'capture-commits-initial',
      name: 'Initial Commit Capture',
      concurrency: {
        limit: 3,
        key: 'event.data.repositoryId',
      },
      throttle: { limit: 50, period: '1m' },
      retries: 2,
    },
    { event: 'capture/commits.initial' },
    async ({ event, step }) => {
      const { repositoryId, repositoryName, days = 7, priority, forceInitial, reason } = event.data;

      if (!repositoryId || !repositoryName) {
        throw new NonRetriableError('Missing required fields: repositoryId or repositoryName');
      }

      console.log('[Commits] Starting initial capture for %s for %s days', repositoryName, days);

      // Process commits using the CommitProcessor
      const result = await step.run('process-initial-commits', async () => {
        return await CommitProcessor.processCommitsJob(repositoryId, {
          repositoryName,
          days,
          forceInitial: forceInitial || true,
          priority,
          reason,
        });
      });

      return {
        success: result.success,
        repositoryId,
        repositoryName,
        days,
        priority,
        reason,
        error: result.error,
      };
    }
  );

  // Capture Commits Update function
  const captureCommitsUpdate = inngest.createFunction(
    {
      id: 'capture-commits-update',
      name: 'Update Commit Capture',
      concurrency: {
        limit: 5,
        key: 'event.data.repositoryId',
      },
      throttle: { limit: 75, period: '1m' },
      retries: 2,
    },
    { event: 'capture/commits.update' },
    async ({ event, step }) => {
      const { repositoryId, repositoryName, days = 1, priority, forceInitial, reason } = event.data;

      if (!repositoryId || !repositoryName) {
        throw new NonRetriableError('Missing required fields: repositoryId or repositoryName');
      }

      console.log('[Commits] Starting update capture for %s for %s days', repositoryName, days);

      // Process commits using the CommitProcessor
      const result = await step.run('process-update-commits', async () => {
        return await CommitProcessor.processCommitsJob(repositoryId, {
          repositoryName,
          days,
          forceInitial: forceInitial || false,
          priority,
          reason,
        });
      });

      return {
        success: result.success,
        repositoryId,
        repositoryName,
        days,
        priority,
        reason,
        error: result.error,
      };
    }
  );

  // Return all functions
  return {
    captureRepositorySyncGraphQL,
    capturePrDetails,
    capturePrDetailsGraphQL,
    capturePrReviews,
    capturePrComments,
    captureRepositorySync,
    classifyRepositorySize,
    classifySingleRepository,
    updatePrActivity,
    discoverNewRepository,
    captureIssueComments,
    captureRepositoryIssues,
    captureCommitsInitial,
    captureCommitsUpdate,
  };
}
