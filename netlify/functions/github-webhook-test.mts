import type { Handler } from '@netlify/functions';
import { hasPrivateKey } from './utils/get-private-key.mjs';

/**
 * Test endpoint for GitHub webhook
 * GET /api/github/webhook-test
 */
export const handler: Handler = async (event) => {
  // Check for private key in various formats
  const privateKeyStatus = await hasPrivateKey();
  
  const environment = {
    hasAppId: !!process.env.GITHUB_APP_ID,
    hasPrivateKey: privateKeyStatus.hasRegularKey,
    hasPrivateKeyEncoded: privateKeyStatus.hasEncodedKey,
    hasSplitKey: privateKeyStatus.hasSplitKey,
    splitKeyParts: privateKeyStatus.splitKeyParts,
    hasPrivateKeyInBlob: privateKeyStatus.hasBlob,
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