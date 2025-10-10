import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Test database connectivity
    const connStart = Date.now();
    const { data: connTest, error: connError } = await supabase
      .from('contributors')
      .select('count')
      .limit(1);
    const connLatency = Date.now() - connStart;

    // Get connection pool status
    const { data: connStats, error: connStatsError } = await supabase.rpc(
      'get_connection_pool_status',
    );

    // Get slow queries from last 5 minutes
    const { data: slowQueries, error: slowError } = await supabase
      .from('slow_queries')
      .select('*')
      .gte('last_call', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(10);

    // Get query performance summary
    const { data: queryStats, error: queryError } = await supabase
      .from('query_performance_summary')
      .select('*')
      .limit(20);

    // Get recent performance alerts
    const { data: alerts, error: alertsError } = await supabase
      .from('query_performance_alerts')
      .select('*')
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    // Get database size stats
    const { data: sizeStats, error: sizeError } = await supabase.rpc('get_database_size_stats');

    // Calculate health metrics
    const dbConnHealthy = !connError && connLatency < 1000;
    const slowQueryCount = slowQueries?.length || 0;
    const alertCount = alerts?.length || 0;
    const hasRecentAlerts = alertCount > 0;

    const overallHealthy = dbConnHealthy && slowQueryCount < 5 && !hasRecentAlerts;
    const status = overallHealthy ? 'healthy' : 'degraded';

    return new Response(
      JSON.stringify({
        success: true,
        status,
        timestamp: new Date().toISOString(),
        connectivity: {
          status: dbConnHealthy ? 'healthy' : 'unhealthy',
          latency: connLatency,
          error: connError?.message || null,
        },
        connection_pool: {
          status: connStatsError ? 'error' : 'healthy',
          stats: connStats || null,
          error: connStatsError?.message || null,
        },
        performance: {
          slow_queries_5min: slowQueryCount,
          recent_alerts: alertCount,
          query_stats: queryStats?.slice(0, 5) || [],
          status: slowQueryCount < 5 ? 'healthy' : 'degraded',
        },
        alerts: {
          count: alertCount,
          recent: alerts || [],
          status: hasRecentAlerts ? 'warning' : 'healthy',
        },
        storage: {
          stats: sizeStats || null,
          status: sizeError ? 'error' : 'healthy',
          error: sizeError?.message || null,
        },
        metadata: {
          service: 'contributor.info',
          component: 'database',
          version: '1.0.0',
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('Database health check error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database health check failed',
        details: error.message,
        metadata: {
          service: 'contributor.info',
          component: 'database',
          version: '1.0.0',
        },
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  }
});
