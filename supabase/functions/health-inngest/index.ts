import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface HealthCheckResult {
  healthy: boolean;
  status: 'healthy' | 'warning' | 'critical';
  checks: {
    stuck_jobs: {
      healthy: boolean;
      total_stuck: number;
      oldest_age_minutes: number;
      threshold_exceeded: boolean;
    };
    recent_completions: {
      healthy: boolean;
      completed_last_hour: number;
      expected_minimum: number;
    };
    failure_rate: {
      healthy: boolean;
      failure_percentage: number;
      threshold: number;
    };
  };
  recommendations: string[];
  timestamp: string;
}

/**
 * Health check for Inngest job processing
 * Detects webhook misconfiguration, stuck jobs, and high failure rates
 */
serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const result: HealthCheckResult = {
      healthy: true,
      status: 'healthy',
      checks: {
        stuck_jobs: {
          healthy: true,
          total_stuck: 0,
          oldest_age_minutes: 0,
          threshold_exceeded: false,
        },
        recent_completions: {
          healthy: true,
          completed_last_hour: 0,
          expected_minimum: 5,
        },
        failure_rate: {
          healthy: true,
          failure_percentage: 0,
          threshold: 50,
        },
      },
      recommendations: [],
      timestamp: new Date().toISOString(),
    };

    // Check 1: Stuck jobs
    const { data: stuckJobsData, error: stuckJobsError } = await supabase.rpc(
      'get_stuck_job_summary',
    );

    if (stuckJobsError) {
      result.healthy = false;
      result.status = 'critical';
      result.checks.stuck_jobs.healthy = false;
      result.recommendations.push(
        '🚨 Failed to query stuck jobs from database. Check database connectivity and RPC function.',
      );
    } else if (stuckJobsData && stuckJobsData.length > 0) {
      const stuckSummary = stuckJobsData[0];
      result.checks.stuck_jobs = {
        healthy: !stuckSummary.needs_attention,
        total_stuck: Number(stuckSummary.total_stuck),
        oldest_age_minutes: Number(stuckSummary.oldest_age_minutes),
        threshold_exceeded: stuckSummary.needs_attention,
      };

      if (stuckSummary.needs_attention) {
        result.healthy = false;
        result.status = 'critical';
        result.recommendations.push(
          '🚨 High number of stuck jobs detected. Check Inngest webhook configuration.',
          `Expected webhook: https://contributor.info/.netlify/functions/inngest-prod`,
          'Verify webhook URL in Inngest dashboard: https://app.inngest.com',
        );
      }
    }

    // Check 2: Recent completions (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentJobs, error: recentError } = await supabase
      .from('progressive_capture_jobs')
      .select('status', { count: 'exact' })
      .eq('status', 'completed')
      .gte('completed_at', oneHourAgo);

    if (!recentError && recentJobs) {
      const completedCount = recentJobs.length;
      result.checks.recent_completions = {
        healthy: completedCount >= result.checks.recent_completions.expected_minimum,
        completed_last_hour: completedCount,
        expected_minimum: result.checks.recent_completions.expected_minimum,
      };

      if (completedCount === 0) {
        result.healthy = false;
        result.status = result.status === 'critical' ? 'critical' : 'warning';
        result.recommendations.push(
          '⚠️ No jobs completed in the last hour. Inngest processing may be stalled.',
        );
      }
    }

    // Check 3: Failure rate (last 2 hours)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: allRecentJobs, error: statsError } = await supabase
      .from('progressive_capture_jobs')
      .select('status')
      .gte('created_at', twoHoursAgo);

    if (!statsError && allRecentJobs) {
      const total = allRecentJobs.length;
      const failed = allRecentJobs.filter((j) => j.status === 'failed').length;
      const failureRate = total > 0 ? (failed / total) * 100 : 0;

      result.checks.failure_rate = {
        healthy: failureRate < result.checks.failure_rate.threshold,
        failure_percentage: Math.round(failureRate * 10) / 10,
        threshold: result.checks.failure_rate.threshold,
      };

      if (failureRate >= result.checks.failure_rate.threshold) {
        result.healthy = false;
        result.status = result.status === 'critical' ? 'critical' : 'warning';
        result.recommendations.push(
          `⚠️ High failure rate: ${failureRate.toFixed(1)}%. Check Inngest function logs.`,
        );
      }
    }

    // HTTP status based on health
    const httpStatus = result.status === 'critical' ? 503 : result.status === 'warning' ? 200 : 200;

    return new Response(JSON.stringify(result, null, 2), {
      status: httpStatus,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return new Response(
      JSON.stringify({
        healthy: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
