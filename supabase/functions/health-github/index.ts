import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

const GITHUB_API_BASE = 'https://api.github.com'

// Simple GitHub API connectivity test
async function testGitHubConnectivity(): Promise<{
  status: string;
  latency: number;
  rateLimits?: Record<string, any>;
  error?: string;
}> {
  const start = Date.now()
  
  try {
    // Test basic GitHub API connectivity without authentication
    // Using the rate limit endpoint as it's lightweight and always available
    const response = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'contributor.info-health-check'
      }
    })
    
    const latency = Date.now() - start
    
    if (!response.ok) {
      return {
        status: 'unhealthy',
        latency,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const data = await response.json()
    
    return {
      status: 'healthy',
      latency,
      rateLimits: data.resources || data
    }
    
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      error: error.message
    }
  }
}

// Test authenticated GitHub API if token is provided
async function testAuthenticatedGitHub(token: string): Promise<{
  status: string;
  latency: number;
  user?: any;
  rateLimits?: Record<string, any>;
  error?: string;
}> {
  const start = Date.now()
  
  try {
    // Test authenticated access with user endpoint
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'contributor.info-health-check'
      }
    })
    
    const latency = Date.now() - start
    
    if (!response.ok) {
      // Check if it's an auth issue
      if (response.status === 401) {
        return {
          status: 'auth_failed',
          latency,
          error: 'Authentication failed - invalid or expired token'
        }
      }
      
      return {
        status: 'unhealthy',
        latency,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    
    const userData = await response.json()
    
    // Get rate limits for authenticated user
    const rateLimitResponse = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'contributor.info-health-check'
      }
    })
    
    const rateLimitData = rateLimitResponse.ok ? await rateLimitResponse.json() : null
    
    return {
      status: 'healthy',
      latency,
      user: {
        login: userData.login,
        id: userData.id,
        type: userData.type
      },
      rateLimits: rateLimitData?.resources || rateLimitData
    }
    
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      error: error.message
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Test basic GitHub API connectivity
    const basicTest = await testGitHubConnectivity()
    
    // Try to get GitHub token from environment or request headers
    const authHeader = req.headers.get('Authorization')
    const githubToken = Deno.env.get('GITHUB_TOKEN') || 
                       (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
    
    let authTest = null
    if (githubToken) {
      authTest = await testAuthenticatedGitHub(githubToken)
    }
    
    // Analyze rate limits for health status
    const rateLimitHealth = analyzeRateLimits(basicTest.rateLimits || authTest?.rateLimits)
    
    // Determine overall health
    const basicHealthy = basicTest.status === 'healthy'
    const authHealthy = !authTest || authTest.status === 'healthy'
    const rateLimitHealthy = rateLimitHealth.status !== 'critical'
    
    const overallHealthy = basicHealthy && authHealthy && rateLimitHealthy
    const status = overallHealthy ? 'healthy' : 'degraded'
    
    // Determine HTTP status code
    const httpStatus = overallHealthy ? 200 : 
                       (basicTest.status === 'unhealthy' ? 503 : 200)

    return new Response(
      JSON.stringify({
        success: true,
        status,
        timestamp: new Date().toISOString(),
        connectivity: {
          status: basicTest.status,
          latency: basicTest.latency,
          error: basicTest.error || null
        },
        authentication: authTest ? {
          status: authTest.status,
          latency: authTest.latency,
          user: authTest.user || null,
          error: authTest.error || null,
          token_provided: !!githubToken
        } : {
          status: 'not_tested',
          token_provided: false,
          message: 'No GitHub token provided for authentication test'
        },
        rate_limits: {
          ...rateLimitHealth,
          data: basicTest.rateLimits || authTest?.rateLimits || null
        },
        recommendations: generateRecommendations(basicTest, authTest, rateLimitHealth),
        metadata: {
          service: 'contributor.info',
          component: 'github-api',
          version: '1.0.0'
        }
      }),
      {
        status: httpStatus,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    )

  } catch (error) {
    console.error('GitHub health check error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'GitHub health check failed',
        details: error.message,
        metadata: {
          service: 'contributor.info',
          component: 'github-api',
          version: '1.0.0'
        }
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      }
    )
  }
})

function analyzeRateLimits(rateLimits: any): {
  status: string;
  critical_resources: string[];
  warnings: string[];
  healthy_resources: string[];
} {
  if (!rateLimits) {
    return {
      status: 'unknown',
      critical_resources: [],
      warnings: [],
      healthy_resources: []
    }
  }
  
  const critical: string[] = []
  const warnings: string[] = []
  const healthy: string[] = []
  
  // Handle both rate_limit endpoint format and resources format
  const resources = rateLimits.resources || rateLimits
  
  for (const [resourceName, limits] of Object.entries(resources)) {
    if (typeof limits !== 'object' || !limits) continue
    
    const limit = (limits as any).limit || 0
    const remaining = (limits as any).remaining || 0
    
    if (limit === 0) continue // Skip if no limit data
    
    const utilizationRate = (limit - remaining) / limit
    
    if (utilizationRate > 0.9) { // >90% used
      critical.push(resourceName)
    } else if (utilizationRate > 0.8) { // >80% used  
      warnings.push(resourceName)
    } else {
      healthy.push(resourceName)
    }
  }
  
  const status = critical.length > 0 ? 'critical' : 
                 warnings.length > 0 ? 'warning' : 'healthy'
  
  return {
    status,
    critical_resources: critical,
    warnings,
    healthy_resources: healthy
  }
}

function generateRecommendations(
  basicTest: any, 
  authTest: any, 
  rateLimitHealth: any
): string[] {
  const recommendations: string[] = []
  
  if (basicTest.status !== 'healthy') {
    recommendations.push('GitHub API connectivity issues detected - check network connectivity')
  }
  
  if (authTest?.status === 'auth_failed') {
    recommendations.push('GitHub authentication failed - verify token is valid and has required permissions')
  }
  
  if (rateLimitHealth.critical_resources.length > 0) {
    recommendations.push(`Critical rate limit usage detected for: ${rateLimitHealth.critical_resources.join(', ')} - consider implementing request throttling`)
  }
  
  if (rateLimitHealth.warnings.length > 0) {
    recommendations.push(`High rate limit usage for: ${rateLimitHealth.warnings.join(', ')} - monitor usage closely`)
  }
  
  if (basicTest.latency > 2000) {
    recommendations.push('High API latency detected - consider implementing caching or retry mechanisms')
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All GitHub API health checks passing - system operating normally')
  }
  
  return recommendations
}