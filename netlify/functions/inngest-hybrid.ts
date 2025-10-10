import { Handler } from '@netlify/functions';
import crypto from 'crypto';
import { executeWithRetry } from './_shared/supabase-client';

// Inngest signing key for webhook verification
const INNGEST_SIGNING_KEY = process.env.INNGEST_SIGNING_KEY || '';

// List of long-running job types that should be delegated to Supabase
const LONG_RUNNING_JOBS = [
  'capture/repository.sync.graphql',
  'capture/repository.sync',
  'capture/pr.details.graphql',
  'capture/pr.reviews',
  'capture/pr.comments',
  'capture/issue.comments',
  'capture/repository.issues',
  'classify/repository.single',
  'classify/repository.size',
  'discover/repository.new',
];

// Function to determine if a job is long-running
function isLongRunningJob(eventName: string): boolean {
  return LONG_RUNNING_JOBS.includes(eventName);
}

// Verify Inngest webhook signature
function verifyInngestSignature(body: string, signature: string | null): boolean {
  if (!INNGEST_SIGNING_KEY) {
    console.error('No Inngest signing key configured - rejecting webhook');
    // Always require signature verification for security
    return false;
  }

  if (!signature) {
    console.error('No signature provided in webhook request');
    return false;
  }

  try {
    // Inngest uses HMAC-SHA256 for webhook signatures
    // Format: "t=timestamp s=signature"
    const parts = signature.split(' ');
    const timestamp = parts.find((p) => p.startsWith('t='))?.substring(2);
    const sig = parts.find((p) => p.startsWith('s='))?.substring(2);

    if (!timestamp || !sig) {
      console.error('Invalid signature format');
      return false;
    }

    // Check timestamp to prevent replay attacks (5 minute window)
    const currentTime = Math.floor(Date.now() / 1000);
    const signatureTime = parseInt(timestamp, 10);
    if (Math.abs(currentTime - signatureTime) > 300) {
      console.error('Signature timestamp too old or too far in future');
      return false;
    }

    // Verify signature
    const signedPayload = `${timestamp}.${body}`;
    const expectedSig = crypto
      .createHmac('sha256', INNGEST_SIGNING_KEY)
      .update(signedPayload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}

// Process quick jobs directly
async function processQuickJob(
  eventName: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  console.log(`Processing quick job: ${eventName}`);

  // Handle quick jobs here
  switch (eventName) {
    case 'test/hello':
      return { message: 'Hello from Netlify!', data };

    case 'user/activity':
      // Quick user activity tracking
      return { tracked: true, timestamp: new Date().toISOString() };

    default:
      console.log(`Unknown quick job type: ${eventName}`);
      return { processed: true };
  }
}

export const handler: Handler = async (event) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-inngest-signature, x-inngest-sdk',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      },
      body: '',
    };
  }

  // Handle GET requests (Inngest introspection)
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        framework: 'netlify',
        appId: 'contributor-info',
        functions: [
          ...LONG_RUNNING_JOBS.map((name) => ({
            id: name.replace(/\//g, '-'),
            name: name,
            triggers: [{ event: name }],
          })),
          { id: 'test-hello', name: 'test/hello', triggers: [{ event: 'test/hello' }] },
          { id: 'user-activity', name: 'user/activity', triggers: [{ event: 'user/activity' }] },
        ],
        hasEventKey: true,
        hasSigningKey: true,
        mode: 'cloud',
      }),
    };
  }

  // Handle PUT requests (Inngest registration)
  if (event.httpMethod === 'PUT') {
    console.log('Inngest registration request received');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Endpoint registered' }),
    };
  }

  // Handle POST requests (Inngest webhooks)
  if (event.httpMethod === 'POST') {
    try {
      // Verify webhook signature
      const signature = event.headers['x-inngest-signature'] || null;

      if (!verifyInngestSignature(event.body || '', signature)) {
        console.error('Invalid webhook signature');
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Unauthorized: Invalid signature' }),
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { name: eventName, data, ts, id: eventId } = body;

      console.log(`Received Inngest event: ${eventName}`);

      // Check if this is a long-running job
      if (isLongRunningJob(eventName)) {
        console.log(`Delegating long-running job ${eventName} to Supabase`);

        // Create job record in Supabase with connection retry
        const { data: job, error: createError } = await executeWithRetry((client) =>
          client
            .from('background_jobs')
            .insert({
              type: eventName,
              payload: data,
              status: 'queued',
              inngest_event_id: eventId,
              repository_id: data?.repositoryId || null,
              created_at: new Date(ts || Date.now()).toISOString(),
            })
            .select()
            .maybeSingle()
        );

        if (createError || !job) {
          console.error('Error creating job:', createError);
          return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Failed to queue job' }),
          };
        }

        // Trigger Supabase Edge Function asynchronously
        const supabaseUrl = process.env.VITE_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabaseFunctionUrl = `${supabaseUrl}/functions/v1/process-job`;

        // Fire and forget - don't await
        fetch(supabaseFunctionUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ jobId: job.id }),
        }).catch((error) => {
          console.error('Error triggering Supabase function:', error);
        });

        // Return success immediately to Inngest
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            jobId: job.id,
            status: 'queued',
            message: `Long-running job ${eventName} queued for processing`,
          }),
        };
      }

      // Process quick job directly
      const result = await processQuickJob(eventName, data);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          result,
          message: `Quick job ${eventName} processed`,
        }),
      };
    } catch (error) {
      console.error('Error processing webhook:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      };
    }
  }

  // Method not allowed
  return {
    statusCode: 405,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
