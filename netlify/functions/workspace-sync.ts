import type { Handler } from '@netlify/functions';
import { Inngest } from 'inngest';

const inngest = new Inngest({
  id: process.env.INNGEST_APP_ID || 'contributor-info',
  eventKey: process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY || '',
  isDev: false,
});

// Simple in-memory rate limiting (resets on function cold start)
// In production, consider using a distributed cache like Redis
const syncRateLimits = new Map<string, { count: number; resetTime: number }>();

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const MAX_SYNCS_PER_WINDOW = 10; // Max 10 manual syncs per hour per workspace

function checkRateLimit(workspaceId: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const key = workspaceId || 'anonymous';

  // Get or initialize rate limit data
  let rateData = syncRateLimits.get(key);

  // Reset if window has expired
  if (!rateData || now > rateData.resetTime) {
    rateData = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
    syncRateLimits.set(key, rateData);
  }

  // Check if request is allowed
  const allowed = rateData.count < MAX_SYNCS_PER_WINDOW;
  const remaining = Math.max(0, MAX_SYNCS_PER_WINDOW - rateData.count - 1);

  // Increment count if allowed
  if (allowed) {
    rateData.count++;
  }

  return {
    allowed,
    remaining,
    resetTime: rateData.resetTime,
  };
}

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

    // Check rate limit for workspace
    let rateLimitInfo: { allowed: boolean; remaining: number; resetTime: number } | undefined;
    if (workspaceId) {
      rateLimitInfo = checkRateLimit(workspaceId);

      if (!rateLimitInfo.allowed) {
        // TODO: Add PostHog tracking for rate limit hit
        // posthog.capture('workspace_sync_rate_limited', {
        //   workspaceId,
        //   resetTime: new Date(rateLimitInfo.resetTime).toISOString(),
        // });

        return {
          statusCode: 429,
          headers: {
            'X-RateLimit-Limit': String(MAX_SYNCS_PER_WINDOW),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(rateLimitInfo.resetTime / 1000)),
            'Retry-After': String(Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)),
          },
          body: JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many sync requests. Please wait ${Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)} seconds before trying again.`,
            resetTime: new Date(rateLimitInfo.resetTime).toISOString(),
          }),
        };
      }
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

    // TODO: Add PostHog tracking for successful sync
    // posthog.capture('workspace_sync_initiated', {
    //   workspaceId,
    //   repositoryCount: repositoryIds.length,
    //   successCount,
    //   failureCount,
    // });

    // Build response with rate limit headers if applicable
    const response: {
      statusCode: number;
      body: string;
      headers?: Record<string, string>;
    } = {
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

    // Add rate limit headers if workspace was provided
    if (rateLimitInfo) {
      response.headers = {
        'X-RateLimit-Limit': String(MAX_SYNCS_PER_WINDOW),
        'X-RateLimit-Remaining': String(rateLimitInfo.remaining),
        'X-RateLimit-Reset': String(Math.floor(rateLimitInfo.resetTime / 1000)),
      };
    }

    return response;
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
