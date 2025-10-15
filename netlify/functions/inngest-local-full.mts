// Local development Inngest function with ALL production functions
import { serve } from 'inngest/lambda';
import type { Context } from '@netlify/functions';
import { inngest } from '../../src/lib/inngest/client';
import {
  capturePrDetails,
  capturePrReviews,
  capturePrComments,
  captureRepositorySync,
  capturePrDetailsGraphQL,
  captureRepositorySyncGraphQL,
  captureRepositorySyncEnhanced,
  classifyRepositorySize,
  classifySingleRepository,
  discoverNewRepository,
  captureRepositoryDiscussions,
  syncDiscussionsCron,
} from '../../src/lib/inngest/functions/index-without-embeddings';

// Import workspace metrics functions
import {
  aggregateWorkspaceMetrics,
  scheduledWorkspaceAggregation,
  handleWorkspaceRepositoryChange,
  cleanupWorkspaceMetricsData,
} from '../../src/lib/inngest/functions/aggregate-workspace-metrics';

// Import priority sync function
import { syncWorkspacePriorities } from '../../src/lib/inngest/functions/sync-workspace-priorities';

// Create the Inngest serve handler with ALL production functions
const inngestHandler = serve({
  client: inngest,
  functions: [
    // PR capture functions
    capturePrDetails,
    capturePrReviews,
    capturePrComments,

    // Repository sync functions
    captureRepositorySync,

    // GraphQL versions for improved efficiency
    capturePrDetailsGraphQL,
    captureRepositorySyncGraphQL,

    // Enhanced sync with backfill support
    captureRepositorySyncEnhanced,

    // Classification functions
    classifyRepositorySize,
    classifySingleRepository,

    // Discovery function
    discoverNewRepository,

    // Discussion sync
    captureRepositoryDiscussions,
    syncDiscussionsCron,

    // Workspace metrics functions
    aggregateWorkspaceMetrics,
    scheduledWorkspaceAggregation,
    handleWorkspaceRepositoryChange,
    cleanupWorkspaceMetricsData,

    // Priority sync
    syncWorkspacePriorities,
  ],
  servePath: '/.netlify/functions/inngest-local-full',
});

// Export the Netlify handler
export default async (req: Request, context: Context) => {
  // Handle GET requests with a status page
  if (req.method === 'GET' && !req.url.includes('?')) {
    return new Response(
      JSON.stringify({
        message: 'Inngest Local Full endpoint (all production functions)',
        endpoint: '/.netlify/functions/inngest-local-full',
        environment: 'local-development',
        functions: [
          'capture-pr-details',
          'capture-pr-reviews',
          'capture-pr-comments',
          'capture-repository-sync',
          'capture-pr-details-graphql',
          'capture-repository-sync-graphql',
          'capture-repository-sync-enhanced',
          'classify-repository-size',
          'classify-single-repository',
          'discover-new-repository',
          'capture-repository-discussions',
          'sync-discussions-cron',
          'aggregate-workspace-metrics',
          'scheduled-workspace-aggregation',
          'handle-workspace-repository-change',
          'cleanup-workspace-metrics-data',
          'sync-workspace-priorities',
        ],
        inngestClient: {
          hasEventKey: !!process.env.INNGEST_EVENT_KEY,
          hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
          isDev: true,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Pass all other requests to Inngest
  return inngestHandler(req, context);
};

// Also export as handler for compatibility
export const handler = inngestHandler;
