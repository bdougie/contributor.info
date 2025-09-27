import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  metrics: {
    queue_depth: number;
    processing_count: number;
    failed_count: number;
    oldest_queued_job_age_seconds: number | null;
    avg_processing_time_seconds: number | null;
    failure_rate_percent: number;
  };
  warnings: string[];
  errors: string[];
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Get queue metrics
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Count jobs by status
    const { count: queuedCount } = await supabase
      .from('background_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    const { count: processingCount } = await supabase
      .from('background_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    const { count: failedCount } = await supabase
      .from('background_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneDayAgo.toISOString());

    const { count: completedCount } = await supabase
      .from('background_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', oneDayAgo.toISOString());

    // Get oldest queued job
    const { data: oldestQueued } = await supabase
      .from('background_jobs')
      .select('created_at')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const oldestQueuedAge = oldestQueued
      ? Math.floor((now.getTime() - new Date(oldestQueued.created_at).getTime()) / 1000)
      : null;

    // Calculate average processing time for completed jobs
    const { data: recentCompleted } = await supabase
      .from('background_jobs')
      .select('started_at, completed_at')
      .eq('status', 'completed')
      .gte('completed_at', oneDayAgo.toISOString())
      .not('started_at', 'is', null)
      .not('completed_at', 'is', null)
      .limit(100);

    let avgProcessingTime: number | null = null;
    if (recentCompleted && recentCompleted.length > 0) {
      const processingTimes = recentCompleted.map((job) => {
        const start = new Date(job.started_at!).getTime();
        const end = new Date(job.completed_at!).getTime();
        return (end - start) / 1000;
      });
      avgProcessingTime = Math.floor(
        processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
      );
    }

    // Calculate failure rate
    const totalProcessed = (failedCount || 0) + (completedCount || 0);
    const failureRate =
      totalProcessed > 0 ? Math.round(((failedCount || 0) / totalProcessed) * 100) : 0;

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check for warnings
    if ((queuedCount || 0) > 100) {
      warnings.push(`High queue depth: ${queuedCount} jobs waiting`);
      status = 'degraded';
    }

    if ((processingCount || 0) > 20) {
      warnings.push(`Many jobs processing: ${processingCount} concurrent jobs`);
      status = 'degraded';
    }

    if (oldestQueuedAge && oldestQueuedAge > 600) {
      // 10 minutes
      warnings.push(
        `Old jobs in queue: oldest job is ${Math.floor(oldestQueuedAge / 60)} minutes old`
      );
      status = 'degraded';
    }

    if (failureRate > 10) {
      warnings.push(`High failure rate: ${failureRate}% of jobs failing`);
      status = 'degraded';
    }

    // Check for errors
    if ((queuedCount || 0) > 500) {
      errors.push(`Critical queue depth: ${queuedCount} jobs waiting`);
      status = 'unhealthy';
    }

    if (oldestQueuedAge && oldestQueuedAge > 3600) {
      // 1 hour
      errors.push(
        `Stale jobs in queue: oldest job is ${Math.floor(oldestQueuedAge / 3600)} hours old`
      );
      status = 'unhealthy';
    }

    if (failureRate > 50) {
      errors.push(`Critical failure rate: ${failureRate}% of jobs failing`);
      status = 'unhealthy';
    }

    const healthStatus: HealthStatus = {
      status,
      timestamp: now.toISOString(),
      metrics: {
        queue_depth: queuedCount || 0,
        processing_count: processingCount || 0,
        failed_count: failedCount || 0,
        oldest_queued_job_age_seconds: oldestQueuedAge,
        avg_processing_time_seconds: avgProcessingTime,
        failure_rate_percent: failureRate,
      },
      warnings,
      errors,
    };

    // Return appropriate status code based on health
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;

    return new Response(JSON.stringify(healthStatus), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          queue_depth: 0,
          processing_count: 0,
          failed_count: 0,
          oldest_queued_job_age_seconds: null,
          avg_processing_time_seconds: null,
          failure_rate_percent: 0,
        },
        warnings: [],
        errors: ['Health check failed'],
      }),
      {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
