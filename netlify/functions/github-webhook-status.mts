import type { Handler } from '@netlify/functions';

/**
 * Health check endpoint for GitHub webhook configuration
 * Helps diagnose issues with webhook processing
 */
export const handler: Handler = async (event) => {
  // Only handle GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Check environment variables
  const envCheck = {
    hasAppId: !!process.env.GITHUB_APP_ID,
    appId: process.env.GITHUB_APP_ID ? 'configured' : 'missing',
    hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY,
    hasPrivateKeyEncoded: !!process.env.GITHUB_APP_PRIVATE_KEY_ENCODED,
    hasPrivateKeyBase64: !!process.env.GITHUB_APP_PRIVATE_KEY_BASE64,
    hasPemPart1: !!process.env.GITHUB_PEM_PART1,
    privateKeyLength: process.env.GITHUB_APP_PRIVATE_KEY?.length || 0,
    hasWebhookSecret: !!process.env.GITHUB_APP_WEBHOOK_SECRET,
    hasClientId: !!process.env.GITHUB_APP_CLIENT_ID,
    hasClientSecret: !!process.env.GITHUB_APP_CLIENT_SECRET,
    hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
    hasSupabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
  };

  // Try to load auth module
  let authStatus = 'not_tested';
  let authError = null;
  
  try {
    const { githubAppAuth } = await import('../../app/lib/auth');
    authStatus = githubAppAuth.isReady() ? 'ready' : 'not_configured';
  } catch (error) {
    authStatus = 'error';
    authError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Try to load handlers
  let handlersStatus = 'not_tested';
  let handlersError = null;
  
  try {
    await import('../../app/webhooks/pull-request-direct');
    await import('../../app/webhooks/issues-direct');
    await import('../../app/webhooks/labeled');
    handlersStatus = 'loaded';
  } catch (error) {
    handlersStatus = 'error';
    handlersError = error instanceof Error ? error.message : 'Unknown error';
  }

  // Overall health
  const isHealthy = 
    envCheck.hasAppId && 
    (envCheck.hasPrivateKey || envCheck.hasPrivateKeyEncoded || envCheck.hasPrivateKeyBase64 || envCheck.hasPemPart1) &&
    envCheck.hasWebhookSecret &&
    authStatus === 'ready' &&
    handlersStatus === 'loaded';

  const response = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: {
      ...envCheck,
      nodeVersion: process.version,
    },
    auth: {
      status: authStatus,
      error: authError,
    },
    handlers: {
      status: handlersStatus,
      error: handlersError,
    },
    webhookEndpoint: 'https://contributor.info/api/github/webhook',
    supportedEvents: [
      'pull_request.opened',
      'pull_request.labeled',
      'issues.opened',
      'issues.labeled',
      'installation',
      'issue_comment',
    ],
    recommendations: [],
  };

  // Add recommendations based on issues found
  if (!envCheck.hasAppId) {
    response.recommendations.push('Set GITHUB_APP_ID environment variable');
  }
  
  if (!envCheck.hasPrivateKey && !envCheck.hasPrivateKeyEncoded && !envCheck.hasPrivateKeyBase64 && !envCheck.hasPemPart1) {
    response.recommendations.push('Set GitHub App private key (GITHUB_APP_PRIVATE_KEY or alternatives)');
  }
  
  if (!envCheck.hasWebhookSecret) {
    response.recommendations.push('Set GITHUB_APP_WEBHOOK_SECRET environment variable');
  }
  
  if (authStatus === 'not_configured') {
    response.recommendations.push('Check GitHub App credentials are valid');
  }
  
  if (authStatus === 'error') {
    response.recommendations.push(`Fix auth initialization error: ${authError}`);
  }
  
  if (handlersStatus === 'error') {
    response.recommendations.push(`Fix handler loading error: ${handlersError}`);
  }

  return {
    statusCode: isHealthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(response, null, 2),
  };
};