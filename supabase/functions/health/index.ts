/**
 * Health Check Edge Function
 *
 * Provides comprehensive health status for the contributor.info application.
 * Checks database connectivity, system metrics, and response times to ensure
 * the service is functioning properly.
 *
 * Health checks include:
 * - Database connectivity and latency (< 2s threshold)
 * - System statistics and database size
 * - Overall service health status
 *
 * @example
 * GET /functions/v1/health
 *
 * @returns
 * {
 *   "success": true,
 *   "status": "healthy",
 *   "timestamp": "2024-01-01T00:00:00.000Z",
 *   "checks": {
 *     "database": {
 *       "status": "healthy",
 *       "latency": 50
 *     },
 *     "system": {
 *       "status": "healthy",
 *       "latency": 100
 *     }
 *   },
 *   "metadata": {
 *     "service": "contributor.info",
 *     "version": "1.0.0",
 *     "environment": "production"
 *   }
 * }
 */

import { createSupabaseClient } from '../_shared/database.ts';
import { corsPreflightResponse, errorResponse, successResponse } from '../_shared/responses.ts';
import { createLogger } from '../_shared/logger.ts';
import { PerformanceMonitor } from '../_shared/metrics.ts';

/**
 * Health Check Edge Function
 *
 * Provides comprehensive health status for edge functions infrastructure.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  const logger = createLogger('health');
  const monitor = new PerformanceMonitor('health');

  try {
    const checks = await monitor.measure('health_checks', async () => {
      const databaseCheck = await checkDatabase();
      const environmentCheck = checkEnvironment();

      return {
        database: databaseCheck,
        system: {
          status: environmentCheck.status ? 'healthy' : 'unhealthy',
          latency: environmentCheck.latency,
        },
        timestamp: new Date().toISOString(),
      };
    });

    // Check if all subsystems are healthy AND latency is acceptable
    const isHealthy = checks.database.status === 'healthy' &&
      checks.system.status === 'healthy' &&
      checks.database.latency < 2000 && // < 2s threshold
      checks.system.latency < 1000; // < 1s threshold

    logger.info('Health check completed', { checks, isHealthy });

    // Use direct response format to match documented contract
    const healthResponse = {
      success: true,
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: checks.timestamp,
      checks,
      metadata: {
        service: 'contributor.info',
        version: '1.0.0',
        environment: Deno.env.get('ENVIRONMENT') || 'development',
      },
    };

    if (isHealthy) {
      return new Response(JSON.stringify(healthResponse), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      });
    } else {
      // Include checks data in unhealthy response for visibility
      const unhealthyResponse = {
        success: false,
        status: 'unhealthy',
        timestamp: checks.timestamp,
        checks, // Include checks payload so clients can see which subsystem failed
        error: 'One or more health checks failed',
        code: 'UNHEALTHY',
        metadata: {
          service: 'contributor.info',
          version: '1.0.0',
          environment: Deno.env.get('ENVIRONMENT') || 'development',
        },
      };

      return new Response(JSON.stringify(unhealthyResponse), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      });
    }
  } catch (error) {
    logger.error('Health check failed', error);
    return errorResponse('Health check failed', 503, error.message, 'HEALTH_CHECK_FAILED');
  }
});

async function checkDatabase(): Promise<{ status: string; latency: number }> {
  const startTime = performance.now();
  try {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('contributors').select('count').limit(1);
    const latency = performance.now() - startTime;

    return {
      status: error ? 'unhealthy' : 'healthy',
      latency: Math.round(latency),
    };
  } catch {
    const latency = performance.now() - startTime;
    return {
      status: 'unhealthy',
      latency: Math.round(latency),
    };
  }
}

function checkEnvironment(): { status: boolean; latency: number } {
  const startTime = performance.now();
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const status = requiredVars.every((v) => Deno.env.get(v));
  const latency = performance.now() - startTime;

  return {
    status,
    latency: Math.round(latency),
  };
}
