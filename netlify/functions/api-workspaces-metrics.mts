/**
 * API Endpoint: Workspace Metrics
 * Provides aggregated metrics for workspaces with caching
 */

import type { Handler, HandlerEvent } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';
import type { MetricsTimeRange } from '@/types/workspace';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/**
 * Handle OPTIONS request for CORS
 */
const handleOptions = (): Response => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

/**
 * Get metrics for a workspace
 */
const handleGetMetrics = async (event: HandlerEvent): Promise<Response> => {
  try {
    // Parse query parameters
    const params = new URLSearchParams(event.rawUrl.split('?')[1] || '');
    const workspaceId = params.get('workspaceId');
    const timeRange = (params.get('timeRange') || '30d') as MetricsTimeRange;
    const forceRefresh = params.get('forceRefresh') === 'true';

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate workspace exists and user has access
    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, visibility')
      .eq('id', workspaceId)
      .single();

    if (workspaceError || !workspace) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check user authorization for private workspaces
    if (workspace.visibility === 'private') {
      const authHeader = event.headers.authorization;
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Verify user is a member of the workspace
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authorization' }),
          {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { data: member } = await supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .single();

      if (!member) {
        return new Response(
          JSON.stringify({ error: 'Access denied' }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Get metrics from cache
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('workspace_metrics_cache')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('time_range', timeRange)
      .single();

    if (metricsError || !metrics) {
      // No cached metrics, trigger aggregation
      await triggerAggregation(workspaceId, timeRange);
      
      return new Response(
        JSON.stringify({ 
          message: 'Metrics are being calculated. Please try again in a moment.',
          status: 'processing'
        }),
        {
          status: 202, // Accepted
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if cache is stale
    const isExpired = new Date(metrics.expires_at) < new Date();
    const needsRefresh = metrics.is_stale || isExpired || forceRefresh;

    if (needsRefresh) {
      // Trigger background refresh
      await triggerAggregation(workspaceId, timeRange);
    }

    // Transform and return metrics
    const response = {
      id: metrics.id,
      workspace_id: metrics.workspace_id,
      time_range: metrics.time_range,
      period_start: metrics.period_start,
      period_end: metrics.period_end,
      metrics: {
        total_prs: metrics.total_prs,
        merged_prs: metrics.merged_prs,
        open_prs: metrics.open_prs,
        draft_prs: metrics.draft_prs,
        total_issues: metrics.total_issues,
        closed_issues: metrics.closed_issues,
        open_issues: metrics.open_issues,
        total_contributors: metrics.total_contributors,
        active_contributors: metrics.active_contributors,
        new_contributors: metrics.new_contributors,
        total_commits: metrics.total_commits,
        total_stars: metrics.total_stars,
        total_forks: metrics.total_forks,
        total_watchers: metrics.total_watchers,
        avg_pr_merge_time_hours: metrics.avg_pr_merge_time_hours,
        pr_velocity: metrics.pr_velocity,
        issue_closure_rate: metrics.issue_closure_rate,
        languages: metrics.language_distribution || {},
        top_contributors: metrics.top_contributors || [],
        activity_timeline: metrics.activity_timeline || [],
        repository_stats: metrics.repository_stats || [],
        // Trends
        stars_trend: metrics.stars_trend || 0,
        prs_trend: metrics.prs_trend || 0,
        contributors_trend: metrics.contributors_trend || 0,
        commits_trend: metrics.commits_trend || 0,
      },
      calculated_at: metrics.calculated_at,
      expires_at: metrics.expires_at,
      is_stale: metrics.is_stale || isExpired,
      cache_hit: !needsRefresh,
      freshness: isExpired ? 'expired' : metrics.is_stale ? 'stale' : 'fresh'
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=300' // Cache for 5 minutes
        },
      }
    );
  } catch (error) {
    console.error('Error fetching workspace metrics:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * Trigger metrics aggregation
 */
const handleTriggerAggregation = async (event: HandlerEvent): Promise<Response> => {
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { workspaceId, timeRange = '30d', priority = 50 } = body;

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify workspace exists
    const { data: workspace, error } = await supabaseAdmin
      .from('workspaces')
      .select('id, tier')
      .eq('id', workspaceId)
      .single();

    if (error || !workspace) {
      return new Response(
        JSON.stringify({ error: 'Workspace not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Trigger aggregation via Inngest
    await triggerAggregation(workspaceId, timeRange, priority);

    return new Response(
      JSON.stringify({ 
        message: 'Aggregation triggered successfully',
        workspaceId,
        timeRange
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error triggering aggregation:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * Get metrics for multiple time ranges
 */
const handleGetMultipleMetrics = async (event: HandlerEvent): Promise<Response> => {
  try {
    const params = new URLSearchParams(event.rawUrl.split('?')[1] || '');
    const workspaceId = params.get('workspaceId');
    const timeRanges = params.get('timeRanges')?.split(',') || ['7d', '30d', '90d'];

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: 'workspaceId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch all time ranges from cache
    const { data: metricsArray, error } = await supabaseAdmin
      .from('workspace_metrics_cache')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('time_range', timeRanges);

    if (error) {
      console.error('Error fetching multiple metrics:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch metrics' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create a map of time range to metrics
    const metricsMap: Record<string, any> = {};
    
    for (const timeRange of timeRanges) {
      const metrics = metricsArray?.find(m => m.time_range === timeRange);
      
      if (metrics) {
        metricsMap[timeRange] = {
          ...metrics,
          cache_hit: true,
          freshness: new Date(metrics.expires_at) < new Date() ? 'expired' : 
                     metrics.is_stale ? 'stale' : 'fresh'
        };
      } else {
        // Trigger aggregation for missing time range
        await triggerAggregation(workspaceId, timeRange as MetricsTimeRange);
        metricsMap[timeRange] = {
          status: 'processing',
          message: 'Metrics are being calculated'
        };
      }
    }

    return new Response(
      JSON.stringify({
        workspaceId,
        metrics: metricsMap
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching multiple metrics:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * Helper function to trigger aggregation via Inngest
 */
async function triggerAggregation(
  workspaceId: string,
  timeRange: MetricsTimeRange,
  priority = 50
): Promise<void> {
  try {
    await inngest.send({
      name: 'workspace.metrics.aggregate',
      data: {
        workspaceId,
        timeRange,
        priority,
        triggeredBy: 'manual'
      }
    });
  } catch (error) {
    console.error('Failed to trigger Inngest event:', error);
  }
}

/**
 * Main handler
 */
export const handler: Handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return handleOptions();
  }

  // Route requests
  if (method === 'GET') {
    if (path.includes('/multiple')) {
      return handleGetMultipleMetrics(event);
    }
    return handleGetMetrics(event);
  }

  if (method === 'POST') {
    if (path.includes('/aggregate')) {
      return handleTriggerAggregation(event);
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
};