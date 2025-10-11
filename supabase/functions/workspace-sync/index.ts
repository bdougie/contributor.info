/**
 * Workspace Sync Edge Function
 * 
 * Triggers repository syncs for workspaces with rate limiting.
 * Updates tracked_repositories timestamps and triggers Inngest metrics aggregation.
 * 
 * @example
 * POST /functions/v1/workspace-sync
 * {
 *   "repositoryIds": ["repo-id-1", "repo-id-2"],
 *   "workspaceId": "workspace-123"
 * }
 * 
 * @returns
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Sync requested for 2 repositories",
 *     "results": [...],
 *     "summary": { "total": 2, "successful": 2, "failed": 0 }
 *   }
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  successResponse, 
  errorResponse, 
  validationError,
  rateLimitError,
  handleError,
  corsPreflightResponse 
} from '../_shared/responses.ts';

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const inngestEventKey = Deno.env.get('INNGEST_EVENT_KEY');

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const MAX_SYNCS_PER_WINDOW = 10; // Max 10 manual syncs per hour per workspace

// Simple in-memory rate limiting
const syncRateLimits = new Map<string, { count: number; resetTime: number }>();

interface RequestBody {
  repositoryIds: string[];
  workspaceId?: string;
}

interface SyncResult {
  repositoryId: string;
  status: 'success' | 'failed';
  repository?: string;
  error?: string;
}

interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Validates the request body
 */
function validateRequest(body: unknown): body is RequestBody {
  if (typeof body !== 'object' || body === null) {
    throw new Error('Request body must be an object');
  }

  const { repositoryIds } = body as Record<string, unknown>;

  if (!Array.isArray(repositoryIds) || repositoryIds.length === 0) {
    throw new Error('repositoryIds array is required and must not be empty');
  }

  if (!repositoryIds.every(id => typeof id === 'string')) {
    throw new Error('All repositoryIds must be strings');
  }

  return true;
}

/**
 * Checks rate limit for a workspace
 */
function checkRateLimit(workspaceId: string): RateLimitInfo {
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

/**
 * Triggers sync for a single repository
 */
async function syncRepository(
  repositoryId: string,
  supabase: ReturnType<typeof createClient>
): Promise<SyncResult> {
  try {
    // Update the repository's sync_requested_at timestamp
    const { data, error } = await supabase
      .from('tracked_repositories')
      .update({
        sync_requested_at: new Date().toISOString(),
        sync_priority: 'high',
      })
      .eq('id', repositoryId)
      .select('organization_name, repository_name')
      .maybeSingle();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!data) {
      throw new Error('Repository not found');
    }

    console.log('Marked repository %s/%s for sync', data.organization_name, data.repository_name);

    return {
      repositoryId,
      status: 'success',
      repository: `${data.organization_name}/${data.repository_name}`,
    };
  } catch (error) {
    console.error('Failed to mark repository %s for sync: %s', repositoryId, error instanceof Error ? error.message : String(error));
    return {
      repositoryId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Logs workspace sync event
 */
async function logWorkspaceSync(
  workspaceId: string,
  repositoriesCount: number,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  try {
    await supabase.from('workspace_sync_logs').insert({
      workspace_id: workspaceId,
      repositories_synced: repositoriesCount,
      sync_type: 'manual',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log sync event: %s', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Triggers workspace metrics aggregation via Inngest
 */
async function triggerMetricsAggregation(workspaceId: string): Promise<void> {
  if (!inngestEventKey || inngestEventKey === 'local_development_only') {
    console.warn('INNGEST_EVENT_KEY not configured - skipping metrics aggregation');
    return;
  }

  try {
    const inngestUrl = `https://inn.gs/e/${inngestEventKey}`;
    const response = await fetch(inngestUrl, {
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

    if (response.ok) {
      console.log('Triggered workspace metrics aggregation for workspace %s', workspaceId);
    } else {
      const errorText = await response.text();
      console.error('Failed to trigger workspace metrics aggregation: %s', errorText);
    }
  } catch (error) {
    console.error('Error triggering workspace metrics aggregation: %s', error instanceof Error ? error.message : String(error));
    // Don't fail the sync operation if metrics aggregation fails
  }
}

/**
 * Main function handler
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    validateRequest(body);

    const { repositoryIds, workspaceId } = body as RequestBody;

    // Check rate limit if workspace provided
    if (workspaceId) {
      const rateLimitInfo = checkRateLimit(workspaceId);

      if (!rateLimitInfo.allowed) {
        const retryAfter = Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000);
        return rateLimitError(retryAfter);
      }
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process repository syncs
    const syncResults = await Promise.allSettled(
      repositoryIds.map(repoId => syncRepository(repoId, supabase))
    );

    // Process results
    const results: SyncResult[] = syncResults.map((result) =>
      result.status === 'fulfilled' ? result.value : result.reason
    );

    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    // Log workspace sync event and trigger metrics aggregation if workspace provided
    if (workspaceId && successCount > 0) {
      await Promise.all([
        logWorkspaceSync(workspaceId, successCount, supabase),
        triggerMetricsAggregation(workspaceId),
      ]);
    }

    // Return success response
    return successResponse({
      message: `Sync requested for ${successCount} repositories`,
      results,
      summary: {
        total: repositoryIds.length,
        successful: successCount,
        failed: failedCount,
      },
    });

  } catch (error) {
    return handleError(error, 'workspace sync');
  }
});