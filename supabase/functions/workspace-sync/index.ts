// Workspace Sync Request
//
// Lets a signed-in workspace member ask for the workspace's repositories to be
// picked up by the next background capture run. This only queues work: it marks
// `workspace_tracked_repositories.next_sync_at` as due (the column the capture
// queue reads) and triggers metrics aggregation. It does not fetch GitHub and
// it does not prove any data was refreshed; callers must not present its
// response as "data is fresh".
//
// Per-repository results are truthful. HTTP 200 means the request was
// processed; `summary.failed` and each result's `error` say what did not queue.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { isWorkspaceMember } from '../_shared/workspace-membership.ts';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_SYNCS_PER_WINDOW = 10;
const MAX_REPOSITORIES = 50;

const syncRateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(workspaceId: string): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
} {
  const now = Date.now();
  for (const [key, data] of syncRateLimits.entries()) {
    if (now > data.resetTime) syncRateLimits.delete(key);
  }
  const existing = syncRateLimits.get(workspaceId);
  if (!existing || now > existing.resetTime) {
    const resetTime = now + RATE_LIMIT_WINDOW_MS;
    syncRateLimits.set(workspaceId, { count: 1, resetTime });
    return { allowed: true, remaining: MAX_SYNCS_PER_WINDOW - 1, resetTime };
  }
  if (existing.count >= MAX_SYNCS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetTime: existing.resetTime };
  }
  existing.count++;
  return {
    allowed: true,
    remaining: MAX_SYNCS_PER_WINDOW - existing.count,
    resetTime: existing.resetTime,
  };
}

interface QueueResult {
  repositoryId: string;
  repository?: string;
  status: 'queued' | 'failed';
  error?: string;
}

function json(status: number, body: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

async function triggerMetricsAggregation(workspaceId: string): Promise<boolean> {
  const inngestEventKey = Deno.env.get('INNGEST_PRODUCTION_EVENT_KEY');
  if (!inngestEventKey || inngestEventKey === 'local_development_only') {
    console.warn(
      '[workspace-sync] INNGEST_PRODUCTION_EVENT_KEY not configured; skipping aggregation',
    );
    return false;
  }
  try {
    const response = await fetch(`https://inn.gs/e/${inngestEventKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    if (!response.ok) {
      console.error(
        '[workspace-sync] Metrics aggregation trigger failed: %s',
        await response.text(),
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      '[workspace-sync] Metrics aggregation trigger error: %s',
      error instanceof Error ? error.message : 'Unknown',
    );
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const auth = await authenticateRequest(req);
  if (auth instanceof Response) return auth;
  if (!auth.user) {
    return json(401, { error: 'A signed-in user is required.' });
  }

  let body: { workspaceId?: unknown; repositoryIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Request body must be JSON.' });
  }

  const { workspaceId, repositoryIds } = body;
  if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
    return json(400, { error: 'workspaceId is required.' });
  }
  if (!isStringArray(repositoryIds) || repositoryIds.length === 0) {
    return json(400, { error: 'repositoryIds must be a non-empty array.' });
  }
  if (repositoryIds.length > MAX_REPOSITORIES) {
    return json(400, { error: `At most ${MAX_REPOSITORIES} repositories per request.` });
  }

  const rateLimit = checkRateLimit(workspaceId);
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
    return json(
      429,
      {
        error: 'Rate limit exceeded',
        message: `Too many sync requests. Wait ${retryAfterSeconds} seconds before trying again.`,
        resetTime: new Date(rateLimit.resetTime).toISOString(),
      },
      {
        'X-RateLimit-Limit': String(MAX_SYNCS_PER_WINDOW),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(rateLimit.resetTime / 1000)),
        'Retry-After': String(retryAfterSeconds),
      },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json(503, { error: 'Service configuration error' });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // Membership is resolved through app_users, matching the database RLS helper.
  const membership = await isWorkspaceMember(admin, workspaceId, auth.user.id);
  if (membership.error) {
    console.error('[workspace-sync] %s', membership.error);
    return json(500, { error: 'Could not verify workspace membership.' });
  }
  if (!membership.member) {
    return json(403, { error: 'You are not a member of this workspace.' });
  }

  const uniqueIds = [...new Set(repositoryIds)];

  // Resolve the workspace's tracked-repository rows for the requested repositories.
  const { data: trackedRows, error: trackedError } = await admin
    .from('workspace_tracked_repositories')
    .select(
      'id, tracked_repository_id, tracked_repositories!inner(repository_id, repositories!inner(full_name))',
    )
    .eq('workspace_id', workspaceId);
  if (trackedError) {
    console.error('[workspace-sync] Tracked repository lookup failed: %s', trackedError.message);
    return json(500, { error: 'Could not load workspace repositories.' });
  }

  interface TrackedRow {
    id: string;
    tracked_repositories:
      | { repository_id: string; repositories: { full_name: string } | { full_name: string }[] }
      | { repository_id: string; repositories: { full_name: string } | { full_name: string }[] }[];
  }
  const byRepositoryId = new Map<string, { rowId: string; fullName: string }>();
  for (const row of (trackedRows ?? []) as TrackedRow[]) {
    const tracked = Array.isArray(row.tracked_repositories)
      ? row.tracked_repositories[0]
      : row.tracked_repositories;
    if (!tracked) continue;
    const repo = Array.isArray(tracked.repositories)
      ? tracked.repositories[0]
      : tracked.repositories;
    byRepositoryId.set(String(tracked.repository_id), {
      rowId: String(row.id),
      fullName: repo?.full_name ? String(repo.full_name) : String(tracked.repository_id),
    });
  }

  const results: QueueResult[] = [];
  const dueRowIds: string[] = [];
  for (const repositoryId of uniqueIds) {
    const tracked = byRepositoryId.get(repositoryId);
    if (!tracked) {
      results.push({
        repositoryId,
        status: 'failed',
        error: 'This repository is not tracked by the workspace.',
      });
      continue;
    }
    dueRowIds.push(tracked.rowId);
    results.push({ repositoryId, repository: tracked.fullName, status: 'queued' });
  }

  if (dueRowIds.length > 0) {
    const { error: updateError } = await admin
      .from('workspace_tracked_repositories')
      .update({ next_sync_at: new Date().toISOString(), is_active: true })
      .in('id', dueRowIds);
    if (updateError) {
      console.error('[workspace-sync] Could not mark repositories due: %s', updateError.message);
      for (const result of results) {
        if (result.status === 'queued') {
          result.status = 'failed';
          result.error = `Database error: ${updateError.message}`;
        }
      }
    }
  }

  const queuedCount = results.filter((r) => r.status === 'queued').length;
  const failedCount = results.length - queuedCount;
  const aggregationTriggered = queuedCount > 0
    ? await triggerMetricsAggregation(workspaceId)
    : false;

  return json(200, {
    message: queuedCount > 0
      ? `Sync requested for ${queuedCount} of ${results.length} repositories`
      : 'No repositories could be queued for sync',
    requestedAt: new Date().toISOString(),
    aggregationTriggered,
    results,
    summary: { total: results.length, queued: queuedCount, failed: failedCount },
  });
});
