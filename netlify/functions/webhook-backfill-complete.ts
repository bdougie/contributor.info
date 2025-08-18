import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '../../src/lib/inngest/client';
import crypto from 'crypto';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Verify webhook signature using HMAC
function verifyWebhookSignature(body: string, signature: string | undefined): boolean {
  if (!signature) return false;
  
  // Use the same GH_DATPIPE_KEY for both API auth and webhook verification
  const webhookSecret = process.env.GH_DATPIPE_KEY;
  if (!webhookSecret) {
    console.error('[webhook-backfill-complete] No GH_DATPIPE_KEY configured for webhook verification');
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  
  // Timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export const handler: Handler = async (event) => {
  // Standard headers for all responses
  const headers = {
    'Content-Type': 'application/json',
  };

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...headers,
        'Allow': 'POST',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Verify webhook signature
  const signature = event.headers['x-webhook-signature'] || event.headers['x-gh-datpipe-signature'];
  if (!verifyWebhookSignature(event.body || '', signature)) {
    console.error('[webhook-backfill-complete] Invalid webhook signature');
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  try {
    // Parse webhook payload
    const payload = JSON.parse(event.body || '{}');
    
    console.log('[webhook-backfill-complete] Received webhook:', {
      job_id: payload.job_id,
      status: payload.status,
      repository: payload.result?.repository,
    });

    // Validate payload
    if (!payload.job_id || !payload.status) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Bad request', 
          message: 'Invalid webhook payload' 
        }),
      };
    }

    // Handle different completion statuses
    if (payload.status === 'completed') {
      const repository = payload.result?.repository;
      
      if (repository) {
        // Update repository metadata to mark last backfill time
        const [owner, name] = repository.split('/');
        
        const { data: repoData, error: updateError } = await supabase
          .from('repositories')
          .update({
            last_manual_backfill: new Date().toISOString(),
            manual_backfill_job_id: payload.job_id,
          })
          .eq('owner', owner)
          .eq('name', name)
          .select('id')
          .single();

        if (updateError) {
          console.error('[webhook-backfill-complete] Failed to update repository:', updateError);
        } else {
          console.log(`[webhook-backfill-complete] Updated repository ${repository} with backfill completion`);
        }

        // Trigger a refresh of the repository data in the UI
        // Also trigger an Inngest sync to pull the data into our system
        const events: Array<{
          name: string;
          data: any;
        }> = [
          {
            name: 'repository/backfill-completed',
            data: {
              repository,
              jobId: payload.job_id,
              rowsProcessed: payload.result?.rows_processed,
              duration: payload.result?.duration_seconds,
              timestamp: payload.timestamp,
            },
          }
        ];

        // If we have the repository ID, trigger internal sync
        if (repoData?.id) {
          events.push({
            // Trigger internal sync to pull gh-datapipe data into our database
            name: 'capture/repository.sync.graphql',
            data: {
              repositoryId: repoData.id,
              days: 30,
              priority: 'high' as const,
              reason: 'Manual backfill completed via gh-datapipe',
            },
          });
        }

        await inngest.send(events);
      }

      // Log success metrics
      console.log('[webhook-backfill-complete] Backfill completed successfully:', {
        repository: payload.result?.repository,
        rows_processed: payload.result?.rows_processed,
        duration_seconds: payload.result?.duration_seconds,
      });
      
    } else if (payload.status === 'failed') {
      // Log failure for monitoring
      console.error('[webhook-backfill-complete] Backfill failed:', {
        job_id: payload.job_id,
        error: payload.error,
        repository: payload.result?.repository,
      });

      // Could send notification to admin or update error tracking
      await inngest.send({
        name: 'repository/backfill-failed',
        data: {
          repository: payload.result?.repository,
          jobId: payload.job_id,
          error: payload.error,
          timestamp: payload.timestamp,
        },
      });
    }

    // Return success response to acknowledge webhook receipt
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Webhook processed successfully',
        job_id: payload.job_id,
      }),
    };
  } catch (error) {
    console.error('[webhook-backfill-complete] Error processing webhook:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error', 
        message: 'Failed to process webhook' 
      }),
    };
  }
};