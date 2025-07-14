import type { Handler } from '@netlify/functions';
import crypto from 'crypto';

/**
 * GitHub webhook handler for Netlify Functions
 * Receives webhook events from GitHub and processes them
 */
export const handler: Handler = async (event) => {
  // Only handle POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Log environment check
  console.log('GitHub App webhook received');
  console.log('Environment check:', {
    hasAppId: !!process.env.GITHUB_APP_ID,
    hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY,
    hasWebhookSecret: !!process.env.GITHUB_APP_WEBHOOK_SECRET,
  });

  try {
    // Verify webhook signature
    const signature = event.headers['x-hub-signature-256'];
    const eventType = event.headers['x-github-event'];
    const deliveryId = event.headers['x-github-delivery'];
    
    if (!signature || !eventType) {
      console.error('Missing required headers');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required headers' }),
      };
    }

    // Verify the webhook payload
    const isValid = verifyWebhookSignature(
      event.body || '', 
      signature,
      process.env.GITHUB_APP_WEBHOOK_SECRET || ''
    );
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    const payload = JSON.parse(event.body || '{}');
    
    // Log webhook receipt
    console.log({
      event: eventType,
      delivery: deliveryId,
      repository: payload.repository?.full_name || 'unknown',
      action: payload.action,
      installation: payload.installation?.id,
    });

    // For now, just acknowledge receipt
    // TODO: Process events asynchronously via queue
    
    switch (eventType) {
      case 'ping':
        console.log('GitHub App ping received');
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Pong!' }),
        };
        
      case 'installation':
        console.log(`Installation ${payload.action}:`, payload.installation?.account?.login);
        break;
        
      case 'pull_request':
        console.log(`PR ${payload.action}:`, `#${payload.pull_request?.number}`);
        break;
        
      case 'issues':
        console.log(`Issue ${payload.action}:`, `#${payload.issue?.number}`);
        break;
        
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Return success immediately (process async)
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Webhook received',
        event: eventType,
        delivery: deliveryId,
      }),
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
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.warn('No webhook secret configured');
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
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