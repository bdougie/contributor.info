import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface StuckJobMetrics {
  total_stuck: number;
  by_type: Record<string, number>;
  oldest_job_age_minutes: number;
}

/**
 * Automated cleanup of stuck jobs
 * Runs periodically via pg_cron to mark jobs stuck in processing as failed
 */
serve(async (req: Request) => {
  try {
    const STUCK_THRESHOLD_MINUTES = 10;

    // Find stuck jobs
    const { data: stuckJobs, error: findError } = await supabase
      .from('progressive_capture_jobs')
      .select('id, job_type, created_at, started_at, metadata')
      .eq('status', 'processing')
      .lt('started_at', new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString());

    if (findError) {
      throw findError;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No stuck jobs found',
          stuck_jobs: 0,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate metrics
    const metrics: StuckJobMetrics = {
      total_stuck: stuckJobs.length,
      by_type: {},
      oldest_job_age_minutes: 0,
    };

    for (const job of stuckJobs) {
      metrics.by_type[job.job_type] = (metrics.by_type[job.job_type] || 0) + 1;

      const ageMinutes = (Date.now() - new Date(job.started_at).getTime()) / (1000 * 60);
      if (ageMinutes > metrics.oldest_job_age_minutes) {
        metrics.oldest_job_age_minutes = Math.floor(ageMinutes);
      }
    }

    // Mark stuck jobs as failed
    const { error: updateError } = await supabase
      .from('progressive_capture_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: `Job stuck in processing for >${STUCK_THRESHOLD_MINUTES} minutes - likely webhook misconfiguration`,
      })
      .eq('status', 'processing')
      .lt('started_at', new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString());

    if (updateError) {
      throw updateError;
    }

    // Log warning if we're seeing persistent stuck jobs
    if (metrics.total_stuck > 10) {
      console.warn('🚨 HIGH STUCK JOB COUNT DETECTED:', {
        count: metrics.total_stuck,
        oldest_age_minutes: metrics.oldest_job_age_minutes,
        by_type: metrics.by_type,
        likely_cause: 'Inngest webhook misconfiguration',
        fix: 'Verify Inngest webhook URL points to working endpoint',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${metrics.total_stuck} stuck jobs`,
        metrics,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Cleanup failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
