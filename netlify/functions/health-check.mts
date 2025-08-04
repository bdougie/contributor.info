import type { Context } from "@netlify/functions";
import { supabase } from "../../src/lib/supabase";

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  lastChecked: string;
  details?: Record<string, unknown>;
}

async function checkSupabase(): Promise<HealthCheckResult> {
  try {
    // Simple query to check database connectivity
    const { data, error } = await supabase
      .from('sync_logs')
      .select('id')
      .limit(1);

    if (error) {
      return {
        service: 'supabase',
        status: 'unhealthy',
        message: `Database error: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      service: 'supabase',
      status: 'healthy',
      message: 'Database connection successful',
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      service: 'supabase',
      status: 'unhealthy',
      message: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkInngest(): Promise<HealthCheckResult> {
  try {
    // Check if Inngest environment variables are set
    const hasEventKey = !!process.env.INNGEST_EVENT_KEY;
    const hasSigningKey = !!process.env.INNGEST_SIGNING_KEY;
    const hasAppId = !!process.env.VITE_INNGEST_APP_ID;

    if (!hasEventKey || !hasSigningKey) {
      return {
        service: 'inngest',
        status: 'unhealthy',
        message: 'Missing required Inngest environment variables',
        lastChecked: new Date().toISOString(),
        details: {
          hasEventKey,
          hasSigningKey,
          hasAppId,
        },
      };
    }

    // Check recent sync activity
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSyncs, error } = await supabase
      .from('sync_logs')
      .select('id, created_at, status')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return {
        service: 'inngest',
        status: 'degraded',
        message: 'Could not check recent sync activity',
        lastChecked: new Date().toISOString(),
      };
    }

    const successfulSyncs = recentSyncs?.filter(s => s.status === 'completed').length || 0;
    const totalSyncs = recentSyncs?.length || 0;

    if (totalSyncs === 0) {
      return {
        service: 'inngest',
        status: 'degraded',
        message: 'No sync activity in the last 24 hours',
        lastChecked: new Date().toISOString(),
        details: {
          recentSyncs: 0,
        },
      };
    }

    const successRate = successfulSyncs / totalSyncs;
    if (successRate < 0.5) {
      return {
        service: 'inngest',
        status: 'degraded',
        message: `Low success rate: ${(successRate * 100).toFixed(1)}%`,
        lastChecked: new Date().toISOString(),
        details: {
          successfulSyncs,
          totalSyncs,
          successRate: `${(successRate * 100).toFixed(1)}%`,
        },
      };
    }

    return {
      service: 'inngest',
      status: 'healthy',
      message: 'Background jobs are running normally',
      lastChecked: new Date().toISOString(),
      details: {
        successfulSyncs,
        totalSyncs,
        successRate: `${(successRate * 100).toFixed(1)}%`,
      },
    };
  } catch (error) {
    return {
      service: 'inngest',
      status: 'unhealthy',
      message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkGitHubAPI(): Promise<HealthCheckResult> {
  try {
    const hasToken = !!process.env.GITHUB_TOKEN || !!process.env.VITE_GITHUB_TOKEN;
    
    if (!hasToken) {
      return {
        service: 'github',
        status: 'unhealthy',
        message: 'Missing GitHub token',
        lastChecked: new Date().toISOString(),
      };
    }

    // Make a simple API call to check connectivity
    const token = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return {
        service: 'github',
        status: 'unhealthy',
        message: `API returned ${response.status}: ${response.statusText}`,
        lastChecked: new Date().toISOString(),
      };
    }

    const data = await response.json();
    const remaining = data.rate?.remaining || 0;
    const limit = data.rate?.limit || 5000;
    const resetAt = data.rate?.reset ? new Date(data.rate.reset * 1000).toISOString() : null;

    if (remaining < 100) {
      return {
        service: 'github',
        status: 'degraded',
        message: `Low rate limit: ${remaining}/${limit}`,
        lastChecked: new Date().toISOString(),
        details: {
          remaining,
          limit,
          resetAt,
        },
      };
    }

    return {
      service: 'github',
      status: 'healthy',
      message: 'GitHub API connection successful',
      lastChecked: new Date().toISOString(),
      details: {
        remaining,
        limit,
        resetAt,
      },
    };
  } catch (error) {
    return {
      service: 'github',
      status: 'unhealthy',
      message: `API check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

export default async (req: Request, context: Context) => {
  // Run all health checks in parallel
  const [supabaseHealth, inngestHealth, githubHealth] = await Promise.all([
    checkSupabase(),
    checkInngest(),
    checkGitHubAPI(),
  ]);

  const results = [supabaseHealth, inngestHealth, githubHealth];
  
  // Overall health status
  const hasUnhealthy = results.some(r => r.status === 'unhealthy');
  const hasDegraded = results.some(r => r.status === 'degraded');
  
  const overallStatus = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';
  const statusCode = hasUnhealthy ? 503 : hasDegraded ? 200 : 200;

  return new Response(JSON.stringify({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: results,
    environment: {
      context: process.env.CONTEXT || 'unknown',
      nodeEnv: process.env.NODE_ENV || 'unknown',
    },
  }, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};

export const config = {
  path: "/.netlify/functions/health-check",
};