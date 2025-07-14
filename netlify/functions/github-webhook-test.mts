import type { Handler } from '@netlify/functions';

/**
 * Test endpoint for GitHub webhook
 * GET /api/github/webhook-test
 */
export const handler: Handler = async (event) => {
  // Check for private key in various formats
  const hasSplitKey = !!process.env.GITHUB_PEM_PART1;
  const splitKeyParts = hasSplitKey ? [
    !!process.env.GITHUB_PEM_PART1,
    !!process.env.GITHUB_PEM_PART2,
    !!process.env.GITHUB_PEM_PART3,
    !!process.env.GITHUB_PEM_PART4,
    !!process.env.GITHUB_PEM_PART5,
  ].filter(Boolean).length : 0;
  
  const environment = {
    hasAppId: !!process.env.GITHUB_APP_ID,
    hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY,
    hasPrivateKeyEncoded: !!process.env.GITHUB_APP_PRIVATE_KEY_ENCODED,
    hasSplitKey,
    splitKeyParts,
    hasWebhookSecret: !!process.env.GITHUB_APP_WEBHOOK_SECRET,
    hasClientId: !!process.env.GITHUB_APP_CLIENT_ID,
    hasClientSecret: !!process.env.GITHUB_APP_CLIENT_SECRET,
    nodeEnv: process.env.NODE_ENV,
    url: process.env.URL,
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'GitHub App webhook test endpoint',
      method: event.httpMethod,
      path: event.path,
      timestamp: new Date().toISOString(),
      environment,
      headers: {
        'user-agent': event.headers['user-agent'],
        'x-forwarded-for': event.headers['x-forwarded-for'],
      },
    }, null, 2),
  };
};