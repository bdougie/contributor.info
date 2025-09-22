import type { Inngest } from 'inngest';
import type { NonRetriableError } from 'inngest';

/**
 * Factory function to create Inngest functions with a specific client instance.
 * This allows us to use the same function definitions with different clients
 * (e.g., local dev vs production).
 */
export function createInngestFunctions(inngest: Inngest) {
  // Test function to verify connection
  const testFunction = inngest.createFunction(
    { id: 'test-function' },
    { event: 'test/hello' },
    async ({ event, step }) => {
      console.log('Test function executed!', event);

      await step.run('log-event', async () => {
        console.log('Event data:', JSON.stringify(event.data, null, 2));
        return { logged: true };
      });

      return {
        message: 'Hello from Inngest!',
        timestamp: new Date().toISOString(),
        data: event.data,
      };
    }
  );

  // GraphQL Repository Sync function
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
    async ({ event }) => {
      const { repositoryId, days, priority, reason } = event.data;

      // Validate repositoryId first
      if (!repositoryId) {
        console.error('Missing repositoryId in event data:', event.data);
        throw new Error(`Missing required field: repositoryId`) as NonRetriableError;
      }

      // Stub implementation for now - would import actual logic
      console.log(`Syncing repository ${repositoryId} for ${days} days`);

      return {
        success: true,
        repositoryId,
        days,
        priority,
        reason,
        message: 'Repository sync initiated (stub)',
      };
    }
  );

  // Return all functions
  return {
    testFunction,
    captureRepositorySyncGraphQL,
    // Add more functions as needed
  };
}

/**
 * Create functions for local development.
 * These are simpler versions for testing.
 */
export function createLocalTestFunctions(inngest: Inngest) {
  const localTestFunction = inngest.createFunction(
    { id: 'local-test-function' },
    { event: 'test/local.hello' },
    async ({ event }) => {
      console.log('Local test function executed!', event);

      console.log('Environment:', {
        nodeEnv: process.env.NODE_ENV,
        hasEventKey: !!process.env.INNGEST_EVENT_KEY,
        hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
      });

      return {
        message: 'Hello from Local Inngest!',
        timestamp: new Date().toISOString(),
        environment: 'local',
        data: event.data,
      };
    }
  );

  return {
    localTestFunction,
  };
}
