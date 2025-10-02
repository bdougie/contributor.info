// Supabase Edge Function for manual backfill operations
// Can run up to 150 seconds on paid plans, 50 seconds on free tier

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillRequest {
  repository: string;
  days?: number;
  force?: boolean;
  callback_url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { repository, days = 30, force = false } = (await req.json()) as BackfillRequest;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get gh-datapipe configuration (require env vars, no hardcoded fallbacks for security)
    const ghDatapipeUrl = Deno.env.get('GH_DATPIPE_API_URL');
    const ghDatapipeKey = Deno.env.get('GH_DATPIPE_KEY');

    if (!ghDatapipeUrl || !ghDatapipeKey) {
      throw new Error('GH_DATPIPE_API_URL and GH_DATPIPE_KEY must be configured');
    }

    // Step 1: Verify repository exists and is tracked
    const [owner, name] = repository.split('/');
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, full_name')
      .eq('owner', owner)
      .eq('name', name)
      .single();

    if (repoError || !repoData) {
      return new Response(
        JSON.stringify({
          error: 'Repository not found or not tracked',
          details: repoError?.message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Trigger backfill via gh-datapipe API
    console.log(`Triggering backfill for ${repository} (${days} days)`);

    const backfillResponse = await fetch(`${ghDatapipeUrl}/api/backfill/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ghDatapipeKey,
      },
      body: JSON.stringify({
        repository,
        days,
        force,
        // Use Supabase function URL as callback
        callback_url: `${supabaseUrl}/functions/v1/backfill-complete`,
      }),
    });

    if (!backfillResponse.ok) {
      const error = await backfillResponse.text();
      throw new Error(`gh-datapipe API error: ${error}`);
    }

    const backfillData = await backfillResponse.json();

    // Step 3: Store job metadata in Supabase
    const { error: jobError } = await supabase.from('manual_backfill_jobs').insert({
      job_id: backfillData.job_id,
      repository_id: repoData.id,
      repository_name: repository,
      status: 'queued',
      days_requested: days,
      started_at: new Date().toISOString(),
      metadata: backfillData,
    });

    if (jobError) {
      console.error('Failed to store job metadata:', jobError);
    }

    // Step 4: Return job information
    return new Response(
      JSON.stringify({
        success: true,
        job_id: backfillData.job_id,
        status: backfillData.status,
        repository,
        days,
        estimated_completion: backfillData.estimated_completion,
        status_url: backfillData.status_url,
        message: 'Backfill job queued successfully. Monitor progress via job_id.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Backfill error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to trigger backfill',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
