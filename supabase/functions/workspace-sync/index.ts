import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const MAX_SYNCS_PER_WINDOW = 10; // Max 10 manual syncs per hour per workspace

// In-memory rate limiting for workspace syncs
const syncRateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(workspaceId: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  const rateLimitKey = `workspace:${workspaceId}`;

  // Clean up expired entries
  for (const [key, data] of syncRateLimits.entries()) {
    if (now > data.resetTime) {
      syncRateLimits.delete(key);
    }
  }

  const existing = syncRateLimits.get(rateLimitKey);

  if (!existing || now > existing.resetTime) {
    // Start a new window
    const resetTime = now + RATE_LIMIT_WINDOW_MS;
    syncRateLimits.set(rateLimitKey, { count: 1, resetTime });
    return { allowed: true, remaining: MAX_SYNCS_PER_WINDOW - 1, resetTime };
  }

  if (existing.count >= MAX_SYNCS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetTime: existing.resetTime };
  }

  // Increment count
  existing.count++;
  return {
    allowed: true,
    remaining: MAX_SYNCS_PER_WINDOW - existing.count,
    resetTime: existing.resetTime,
  };
}

interface SyncResult {
  repositoryId: string;
  status: 'success' | 'failed';
  repository?: string;
  error?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    const body = await req.json();
    const { repositoryIds, workspaceId } = body;

    // Validate required fields
    if (!repositoryIds || !Array.isArray(repositoryIds) || repositoryIds.length === 0) {
      return new Response(JSON.stringify({ error: 'repositoryIds array is required' }), {
        status: 400,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    }

    // Check rate limit if workspace provided
    if (workspaceId) {
      const rateLimitInfo = checkRateLimit(workspaceId);

      if (!rateLimitInfo.allowed) {
        const headers = new Headers(CORS_HEADERS);
        headers.set('Content-Type', 'application/json');
        headers.set('X-RateLimit-Limit', String(MAX_SYNCS_PER_WINDOW));
        headers.set('X-RateLimit-Remaining', '0');
        headers.set('X-RateLimit-Reset', String(Math.floor(rateLimitInfo.resetTime / 1000)));
        headers.set('Retry-After', String(Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)));

        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many sync requests. Please wait ${Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)} seconds before trying again.`,
            resetTime: new Date(rateLimitInfo.resetTime).toISOString(),
          }),
          {
            status: 429,
            headers,
          }
        );
      }
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({
          error: 'Service configuration error',
          message: 'The sync service is not properly configured.',
        }),
        {
          status: 503,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mark repositories for sync by updating their sync_requested_at timestamp
    const syncResults = await Promise.allSettled(
      repositoryIds.map(async (repoId: string): Promise<SyncResult> => {
        try {
          // Update the repository's sync_requested_at timestamp
          const { data, error } = await supabase
            .from('tracked_repositories')
            .update({
              sync_requested_at: new Date().toISOString(),
              sync_priority: 'high',
            })
            .eq('id', repoId)
            .select('owner, name')
            .maybeSingle();

          if (error) {
            throw new Error(`Database error: ${error.message}`);
          }

          if (!data) {
            throw new Error('Repository not found');
          }

          console.log('[workspace-sync] Marked repository %s/%s for sync', data.owner, data.name);

          return {
            repositoryId: repoId,
            status: 'success',
            repository: `${data.owner}/${data.name}`,
          };
        } catch (error) {
          console.error(
            '[workspace-sync] Failed to mark repository %s for sync: %s',
            repoId,
            error instanceof Error ? error.message : 'Unknown'
          );
          return {
            repositoryId: repoId,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Process results
    const results: SyncResult[] = syncResults.map((result) =>
      result.status === 'fulfilled' ? result.value : result.reason
    );

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    // Log workspace sync event if workspace provided
    if (workspaceId && successCount > 0) {
      try {
        await supabase.from('workspace_sync_logs').insert({
          workspace_id: workspaceId,
          repositories_synced: successCount,
          sync_type: 'manual',
          created_at: new Date().toISOString(),
        });
      } catch (error) {
        console.error(
          '[workspace-sync] Failed to log sync event: %s',
          error instanceof Error ? error.message : 'Unknown'
        );
      }

      // Trigger workspace metrics aggregation via Inngest
      try {
        const inngestEventKey = Deno.env.get('INNGEST_PRODUCTION_EVENT_KEY');
        if (inngestEventKey && inngestEventKey !== 'local_development_only') {
          const inngestUrl = `https://inn.gs/e/${inngestEventKey}`;
          const inngestResponse = await fetch(inngestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: 'workspace.metrics.aggregate',
              data: {
                workspaceId,
                timeRange: 'all',
                priority: 50,
                forceRefresh: true,
                triggeredBy: 'manual_sync',
              },
            }),
          });

          if (inngestResponse.ok) {
            console.log(
              '[workspace-sync] Triggered workspace metrics aggregation for workspace %s',
              workspaceId
            );
          } else {
            console.error(
              '[workspace-sync] Failed to trigger workspace metrics aggregation: %s',
              await inngestResponse.text()
            );
          }
        } else {
          console.warn(
            '[workspace-sync] INNGEST_PRODUCTION_EVENT_KEY not configured - skipping metrics aggregation'
          );
        }
      } catch (error) {
        console.error(
          '[workspace-sync] Error triggering workspace metrics aggregation: %s',
          error instanceof Error ? error.message : 'Unknown'
        );
        // Don't fail the sync operation if metrics aggregation fails
      }
    }

    return new Response(
      JSON.stringify({
        message: `Sync requested for ${successCount} repositories`,
        results,
        summary: {
          total: repositoryIds.length,
          successful: successCount,
          failed: failedCount,
        },
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('[workspace-sync] Error: %s', error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
