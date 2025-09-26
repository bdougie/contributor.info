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

    // Test database connectivity with a simple query
    const dbStart = Date.now();
    const { data: dbTest, error: dbError } = await supabase
      .from('contributors')
      .select('count')
      .limit(1);
    const dbLatency = Date.now() - dbStart;

    // Check if database is responsive
    const dbHealthy = !dbError && dbLatency < 2000;

    // Get basic system metrics
    const systemStart = Date.now();
    const { data: systemStats } = await supabase.rpc('get_database_size_stats').limit(1);
    const systemLatency = Date.now() - systemStart;

    // Overall health status
    const isHealthy = dbHealthy && systemLatency < 3000;
    const status = isHealthy ? 'healthy' : 'unhealthy';
    const statusCode = isHealthy ? 200 : 503;

    return new Response(
      JSON.stringify({
        success: true,
        status,
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: dbHealthy ? 'healthy' : 'unhealthy',
            latency: dbLatency,
            error: dbError?.message || null,
          },
          system: {
            status: systemLatency < 3000 ? 'healthy' : 'unhealthy',
            latency: systemLatency,
            stats: systemStats || null,
          },
        },
        metadata: {
          service: 'contributor.info',
          version: '1.0.0',
          environment: Deno.env.get('ENVIRONMENT') || 'production',
        },
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('Health check error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: error.message,
        metadata: {
          service: 'contributor.info',
          version: '1.0.0',
          environment: Deno.env.get('ENVIRONMENT') || 'production',
        },
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
});
