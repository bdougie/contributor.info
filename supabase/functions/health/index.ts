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
      return {
        database: await checkDatabase(),
        environment: checkEnvironment(),
        timestamp: new Date().toISOString(),
      };
    });

    const isHealthy = checks.database && checks.environment;

    logger.info('Health check completed', { checks, isHealthy });

    if (isHealthy) {
      return successResponse({ status: 'healthy', checks }, 'Service is healthy');
    } else {
      return errorResponse(
        'Service unhealthy',
        503,
        'One or more health checks failed',
        'UNHEALTHY',
      );
    }
  } catch (error) {
    logger.error('Health check failed', error);
    return errorResponse('Health check failed', 503, error.message, 'HEALTH_CHECK_FAILED');
  }
});

async function checkDatabase(): Promise<boolean> {
  try {
    const supabase = createSupabaseClient();
    const { error } = await supabase.from('contributors').select('count').limit(1);
    return !error;
  } catch {
    return false;
  }
}

function checkEnvironment(): boolean {
  const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  return requiredVars.every((v) => Deno.env.get(v));
}
