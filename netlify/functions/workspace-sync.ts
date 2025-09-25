import type { Handler } from '@netlify/functions';
import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: process.env.INNGEST_APP_ID || 'contributor-info',
  eventKey: process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY || '',
  isDev: false,
});

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { repositoryIds, workspaceId } = body;

    // Validate required fields
    if (!repositoryIds || !Array.isArray(repositoryIds) || repositoryIds.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'repositoryIds array is required' }),
      };
    }

    // Check for Inngest event key
    const eventKey = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY;
    if (!eventKey) {
      console.error('[workspace-sync] Missing Inngest event key in environment');
      return {
        statusCode: 503,
        body: JSON.stringify({
          error: 'Service configuration error',
          message: 'The sync service is not properly configured. Please contact support.',
        }),
      };
    }

    // Send sync events for each repository
    const results = await Promise.allSettled(
      repositoryIds.map(async (repoId: string) => {
        try {
          await inngest.send({
            name: 'capture/repository.sync.graphql',
            data: {
              repositoryId: repoId,
              days: 30,
              priority: 'high' as const,
              reason: `Manual workspace sync ${workspaceId ? `for workspace ${workspaceId}` : ''}`,
            },
          });
          return { repositoryId: repoId, status: 'success' };
        } catch (error) {
          console.error(`[workspace-sync] Failed to sync repository ${repoId}:`, error);
          return {
            repositoryId: repoId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Count successes and failures
    const successCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value.status === 'success'
    ).length;
    const failureCount = results.length - successCount;

    // Return appropriate response
    if (successCount === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'All sync requests failed',
          details: results.map((r) =>
            r.status === 'fulfilled' ? r.value : { status: 'failed', error: r.reason }
          ),
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Sync initiated for ${successCount} repositories`,
        successCount,
        failureCount,
        details: results.map((r) =>
          r.status === 'fulfilled' ? r.value : { status: 'failed', error: r.reason }
        ),
      }),
    };
  } catch (error) {
    console.error('[workspace-sync] Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
