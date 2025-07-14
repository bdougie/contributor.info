import type { Handler } from '@netlify/functions';
import crypto from 'crypto';

/**
 * Simplified GitHub webhook handler for debugging
 * This version doesn't require the private key for basic webhook receipt
 */
export const handler: Handler = async (event) => {
  // Get private key from various sources
  let privateKey: string | undefined;
  
  // Try split key parts first
  if (process.env.GITHUB_PEM_PART1) {
    const keyParts = [
      process.env.GITHUB_PEM_PART1,
      process.env.GITHUB_PEM_PART2,
      process.env.GITHUB_PEM_PART3,
      process.env.GITHUB_PEM_PART4,
      process.env.GITHUB_PEM_PART5
    ].filter(Boolean);
    
    privateKey = keyParts.join('').replace(/\\n/g, '\n');
  } 
  // Fall back to encoded format
  else if (process.env.GITHUB_APP_PRIVATE_KEY_ENCODED) {
    privateKey = process.env.GITHUB_APP_PRIVATE_KEY_ENCODED.replace(/\\n/g, '\n');
  }
  // Fall back to regular format
  else {
    privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  }

  console.log('Webhook received:', {
    method: event.httpMethod,
    path: event.path,
    hasBody: !!event.body,
    headers: {
      'x-github-event': event.headers['x-github-event'],
      'x-github-delivery': event.headers['x-github-delivery'],
      'content-type': event.headers['content-type'],
    }
  });

  // Only handle POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const signature = event.headers['x-hub-signature-256'];
    const eventType = event.headers['x-github-event'];
    const deliveryId = event.headers['x-github-delivery'];
    
    // For initial testing, just verify we have the webhook secret
    const hasWebhookSecret = !!process.env.GITHUB_APP_WEBHOOK_SECRET;
    
    console.log('Environment check:', {
      hasAppId: !!process.env.GITHUB_APP_ID,
      hasWebhookSecret,
      hasPrivateKey: !!privateKey,
      privateKeyLength: privateKey?.length || 0,
      appId: process.env.GITHUB_APP_ID,
    });

    // Basic validation
    if (!eventType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing X-GitHub-Event header' }),
      };
    }

    // For ping events, don't verify signature (testing)
    if (eventType === 'ping') {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Pong!',
          app_configured: hasWebhookSecret,
        }),
      };
    }

    // Verify signature for other events
    if (!signature || !hasWebhookSecret) {
      console.warn('Missing signature or webhook secret');
      return {
        statusCode: 401,
        body: JSON.stringify({ 
          error: 'Webhook signature verification not configured',
          hasSignature: !!signature,
          hasSecret: hasWebhookSecret,
        }),
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

    // Parse payload
    const payload = JSON.parse(event.body || '{}');
    
    console.log('Webhook validated:', {
      event: eventType,
      delivery: deliveryId,
      repository: payload.repository?.full_name,
      action: payload.action,
    });

    // Return success
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Webhook received successfully',
        event: eventType,
        repository: payload.repository?.full_name,
      }),
    };
    
  } catch (error) {
    console.error('Webhook error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Verify GitHub webhook signature
 */
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) {
    return false;
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = `sha256=${hmac.update(payload).digest('hex')}`;
    
    return signature === digest;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}