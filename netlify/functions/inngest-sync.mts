// Inngest sync endpoint that properly handles both sync and hybrid routing
// Combines the Inngest SDK serve functionality with hybrid webhook routing

import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context, Handler } from "@netlify/functions";
import { executeWithRetry } from './_shared/supabase-client';

// Import the same functions that inngest-prod uses
import { createCaptureRepositorySyncGraphQL, createClassifySingleRepository } from "./inngest-prod-functions.mjs";
import {
  capturePrDetails,
  capturePrReviews,
  capturePrComments,
  captureIssueComments,
  captureRepositoryIssues,
  captureRepositorySync,
  capturePrDetailsGraphQL,
  classifyRepositorySize,
  discoverNewRepository
} from "../../src/lib/inngest/functions/index-without-embeddings";

// Get production environment variables
const getProductionEnvVar = (key: string, fallbackKey?: string): string => {
  if (process.env.NODE_ENV === 'production' || process.env.CONTEXT === 'production' || process.env.CONTEXT === 'deploy-preview') {
    return process.env[`INNGEST_PRODUCTION_${key}`] || process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
  }
  return process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
};

// Ensure GITHUB_TOKEN is available
if (!process.env.GITHUB_TOKEN && process.env.VITE_GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;
}

// Create Inngest client with proper configuration
const inngest = new Inngest({
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: false,
  eventKey: getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  signingKey: getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
});

// Create functions using the client
const captureRepositorySyncGraphQL = createCaptureRepositorySyncGraphQL(inngest);
const classifySingleRepository = createClassifySingleRepository(inngest);

// Create the Inngest serve handler
const inngestServeHandler = serve({
  client: inngest,
  functions: [
    captureRepositorySyncGraphQL,
    capturePrDetailsGraphQL,
    capturePrDetails,
    capturePrReviews,
    capturePrComments,
    captureIssueComments,
    captureRepositoryIssues,
    captureRepositorySync,
    classifySingleRepository,
    classifyRepositorySize,
    discoverNewRepository
  ],
  servePath: "/.netlify/functions/inngest-sync",
  signingKey: getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
});

// List of long-running job types that need hybrid routing
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

// Main handler that combines SDK serve with hybrid routing logic
const handler: Handler = async (event, context) => {
  // Convert Lambda event to Request for Inngest SDK
  const url = new URL(event.path || '/', `https://${event.headers.host || 'localhost'}`);
  for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
    if (value) url.searchParams.set(key, value);
  }

  const request = new Request(url.toString(), {
    method: event.httpMethod,
    headers: event.headers as HeadersInit,
    body: event.body,
  });

  // For GET/PUT requests (sync/registration), use the standard Inngest handler
  if (event.httpMethod === 'GET' || event.httpMethod === 'PUT') {
    const response = await inngestServeHandler(request, context);
    const responseBody = await response.text();

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    };
  }

  // For POST requests (webhooks), check if it's a long-running job that needs routing
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);

      // Check if this is an Inngest event that needs hybrid routing
      if (body.name && LONG_RUNNING_JOBS.includes(body.name)) {
        console.log(`Routing long-running job ${body.name} to Supabase`);

        // Create job record in Supabase for long-running processing
        const { data: job, error: createError } = await executeWithRetry((client) =>
          client
            .from('background_jobs')
            .insert({
              type: body.name,
              payload: body.data,
              status: 'queued',
              inngest_event_id: body.id,
              repository_id: body.data?.repositoryId || null,
              created_at: new Date(body.ts || Date.now()).toISOString(),
            })
            .select()
            .maybeSingle()
        );

        if (!createError && job) {
          // Trigger Supabase Edge Function asynchronously
          const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

          if (supabaseUrl && supabaseServiceKey) {
            // Fire and forget - don't await
            fetch(`${supabaseUrl}/functions/v1/process-job`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ jobId: job.id }),
            }).catch((error) => {
              console.error('Error triggering Supabase function:', error);
            });
          }

          // Return success to Inngest immediately
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: true,
              jobId: job.id,
              status: 'queued',
              message: `Long-running job ${body.name} queued for processing`,
            }),
          };
        }
      }
    } catch (e) {
      // If parsing fails or it's not a routable job, fall through to standard handler
      console.log('Not a routable job, using standard Inngest processing');
    }
  }

  // For all other requests, use the standard Inngest handler
  const response = await inngestServeHandler(request, context);
  const responseBody = await response.text();

  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: responseBody,
  };
};

export default handler;