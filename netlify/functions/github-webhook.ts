import type { Handler } from '@netlify/functions';
import crypto from 'crypto';

// Import with .js extension for ESM compatibility
const ENV_CONFIG = {
  app_id: process.env.GITHUB_APP_ID || '',
  private_key: process.env.GITHUB_APP_PRIVATE_KEY ? 
    Buffer.from(process.env.GITHUB_APP_PRIVATE_KEY, 'base64').toString() : '',
  webhook_secret: process.env.GITHUB_APP_WEBHOOK_SECRET || '',
  client_id: process.env.GITHUB_APP_CLIENT_ID || '',
  client_secret: process.env.GITHUB_APP_CLIENT_SECRET || '',
};

/**
 * GitHub webhook handler for Netlify Functions
 * Receives webhook events from GitHub and routes them to appropriate handlers
 */
export const handler: Handler = async (event) => {
  // Only handle POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Verify webhook signature
    const signature = event.headers['x-hub-signature-256'];
    const eventType = event.headers['x-github-event'];
    
    if (!signature || !eventType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required headers' }),
      };
    }

    // Verify the webhook payload
    const isValid = verifyWebhookSignature(event.body || '', signature);
    if (!isValid) {
      console.error('Invalid webhook signature');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    const payload = JSON.parse(event.body || '{}');
    
    // Log webhook receipt
    console.log(`Received ${eventType} webhook for ${payload.repository?.full_name || 'unknown repo'}`);

    // Queue the event for async processing
    await inngest.send({
      name: 'github.webhook.received',
      data: {
        event: eventType,
        payload,
        installation_id: payload.installation?.id,
        repository: payload.repository?.full_name,
      },
    });

    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'pull_request':
        await handlePullRequestEvent(payload);
        break;
        
      case 'issues':
        await handleIssuesEvent(payload);
        break;
        
      case 'installation':
        await handleInstallationEvent(payload);
        break;
        
      case 'installation_repositories':
        await handleInstallationRepositoriesEvent(payload);
        break;
        
      // Add more event handlers as needed
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Return success immediately (process async)
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Webhook received' }),
    };
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Still return 200 to prevent GitHub from retrying
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Webhook received with errors',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Verify GitHub webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!ENV_CONFIG.webhook_secret) {
    console.warn('No webhook secret configured');
    return false;
  }

  const hmac = crypto.createHmac('sha256', ENV_CONFIG.webhook_secret);
  const digest = `sha256=${hmac.update(payload).digest('hex')}`;
  
  // Use timingSafeEqual to prevent timing attacks
  if (signature.length !== digest.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}