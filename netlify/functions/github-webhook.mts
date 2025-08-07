import type { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { handlePullRequestEvent } from '../../app/webhooks/pull-request';
import { handlePROpenedDirect } from '../../app/webhooks/pull-request-direct';
import { handleIssuesEvent } from '../../app/webhooks/issues';
import { handleIssueOpenedDirect } from '../../app/webhooks/issues-direct';
import { handleIssueCommentEvent } from '../../app/webhooks/issue-comment';
import { handleInstallationEvent } from '../../app/webhooks/installation';
import { handleLabeledEvent } from '../../app/webhooks/labeled';

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

  // Log environment check (without exposing the actual private key)
  console.log('GitHub App webhook received');
  console.log('Environment check:', {
    hasAppId: !!process.env.GITHUB_APP_ID,
    hasPrivateKey: !!process.env.GITHUB_APP_PRIVATE_KEY,
    privateKeyLength: process.env.GITHUB_APP_PRIVATE_KEY?.length || 0,
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

    // Process events asynchronously without blocking the response
    // This prevents webhook timeouts and GitHub retries
    switch (eventType) {
      case 'ping':
        console.log('GitHub App ping received');
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Pong!' }),
        };
        
      case 'installation':
        console.log(`Installation ${payload.action}:`, payload.installation?.account?.login);
        // Process asynchronously without awaiting
        handleInstallationEvent(payload).catch(error => {
          console.error('Error handling installation event:', error);
        });
        break;
        
      case 'pull_request':
        console.log(`PR ${payload.action}:`, `#${payload.pull_request?.number}`);
        // Use direct handler for opened events (doesn't require DB lookup)
        if (payload.action === 'opened') {
          handlePROpenedDirect(payload).catch(error => {
            console.error('Error handling PR opened event:', error);
          });
        } else if (payload.action === 'labeled') {
          // Handle labeled events for PRs (only 'labeled', not 'unlabeled')
          handleLabeledEvent(payload).catch(error => {
            console.error('Error handling PR labeled event:', error);
          });
        } else {
          // Use original handler for other events
          handlePullRequestEvent(payload).catch(error => {
            console.error('Error handling pull request event:', error);
          });
        }
        break;
        
      case 'issues':
        console.log(`Issue ${payload.action}:`, `#${payload.issue?.number}`);
        // Use direct handler for opened events (more liberal, always responds)
        if (payload.action === 'opened') {
          handleIssueOpenedDirect(payload).catch(error => {
            console.error('Error handling issue opened event:', error);
          });
        } else if (payload.action === 'labeled') {
          // Handle labeled events for issues (only 'labeled', not 'unlabeled')
          handleLabeledEvent(payload).catch(error => {
            console.error('Error handling issue labeled event:', error);
          });
        } else {
          // Use original handler for other events
          handleIssuesEvent(payload).catch(error => {
            console.error('Error handling issues event:', error);
          });
        }
        break;
        
      case 'issue_comment':
        console.log(`Issue comment ${payload.action} on #${payload.issue?.number}`);
        // Process asynchronously without awaiting
        handleIssueCommentEvent(payload).catch(error => {
          console.error('Error handling issue comment event:', error);
        });
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