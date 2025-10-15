import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/database.ts';
import {
  corsPreflightResponse,
  errorResponse,
  legacySuccessResponse,
  validationError,
} from '../_shared/responses.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  if (req.method !== 'POST') {
    return validationError('Invalid method', 'Only POST requests are allowed');
  }

  try {
    const body = await req.json();
    const { owner, repo, workspace_id, max_items = 100 } = body;

    // Validate required fields
    if (!owner || !repo) {
      return validationError('Missing required fields', 'owner and repo parameters are required');
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient();

    // Get repository ID
    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('id, has_discussions')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (repoError || !repository) {
      console.error('Repository not found: %s/%s', owner, repo);
      return errorResponse(
        'Repository not found',
        404,
        'Repository not found in database',
        'REPOSITORY_NOT_FOUND'
      );
    }

    // Check if discussions are enabled
    if (!repository.has_discussions) {
      return errorResponse(
        'Discussions not enabled',
        400,
        'Repository does not have discussions enabled',
        'DISCUSSIONS_NOT_ENABLED'
      );
    }

    // Get Inngest event key to trigger the background job
    const inngestEventKey = Deno.env.get('INNGEST_EVENT_KEY');
    if (!inngestEventKey) {
      return errorResponse(
        'Configuration error',
        500,
        'Inngest event key not configured',
        'INNGEST_NOT_CONFIGURED'
      );
    }

    // Trigger Inngest function to process discussions in the background
    const inngestResponse = await fetch(`https://inn.gs/e/${inngestEventKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'capture/repository.discussions',
        data: {
          repositoryId: repository.id,
          maxItems: max_items,
          workspace_id,
        },
        ts: Date.now(),
      }),
    });

    if (!inngestResponse.ok) {
      const inngestError = await inngestResponse.text();
      console.error('Failed to trigger Inngest: %s', inngestError);
      return errorResponse(
        'Background job failed to start',
        inngestResponse.status,
        `Failed to trigger background processing: ${inngestError}`,
        'INNGEST_TRIGGER_FAILED'
      );
    }

    const inngestData = await inngestResponse.json();
    const eventId = inngestData.ids?.[0] || inngestData.id || inngestData.eventId || 'unknown';

    return legacySuccessResponse(
      {
        jobId: eventId,
        repositoryId: repository.id,
        owner,
        repo,
        maxItems: max_items,
        workspace_id,
      },
      `Discussion sync job started for ${owner}/${repo}`
    );
  } catch (error) {
    console.error('Sync error:', error);
    return errorResponse(
      'Sync discussions failed',
      500,
      error instanceof Error ? error.message : 'Unknown error occurred',
      'SYNC_FAILED'
    );
  }
});
