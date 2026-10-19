import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { startCapture } from '../_shared/datapipe-capture.ts';
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

    // Service-role client, pinned to the version datapipe-capture is typed against
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

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
        'REPOSITORY_NOT_FOUND',
      );
    }

    // Check if discussions are enabled
    if (!repository.has_discussions) {
      return errorResponse(
        'Discussions not enabled',
        400,
        'Repository does not have discussions enabled',
        'DISCUSSIONS_NOT_ENABLED',
      );
    }

    // One gh-datapipe machine per request (capture/repository.discussions),
    // tracked as a datapipe_jobs row; same path queue-event takes for capture/*.
    const capture = await startCapture(supabase, 'capture/repository.discussions', {
      repositoryId: repository.id,
      maxItems: max_items,
      workspace_id,
    });
    const eventId = capture.datapipe_job_id;

    return legacySuccessResponse(
      {
        jobId: eventId,
        repositoryId: repository.id,
        owner,
        repo,
        maxItems: max_items,
        workspace_id,
      },
      `Discussion sync job started for ${owner}/${repo}`,
    );
  } catch (error) {
    console.error('Sync error:', error);
    return errorResponse(
      'Sync discussions failed',
      500,
      error instanceof Error ? error.message : 'Unknown error occurred',
      'SYNC_FAILED',
    );
  }
});
