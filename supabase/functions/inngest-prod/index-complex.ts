import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { Inngest } from 'https://esm.sh/inngest@3.16.1';
import { InngestCommHandler } from 'https://esm.sh/inngest@3.16.1/components/InngestCommHandler';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get Inngest configuration from environment
const INNGEST_APP_ID = Deno.env.get('INNGEST_APP_ID') || 'contributor-info';
const INNGEST_EVENT_KEY = Deno.env.get('INNGEST_EVENT_KEY') ||
  Deno.env.get('INNGEST_PRODUCTION_EVENT_KEY');
const INNGEST_SIGNING_KEY = Deno.env.get('INNGEST_SIGNING_KEY') ||
  Deno.env.get('INNGEST_PRODUCTION_SIGNING_KEY');

// Ensure GitHub token is available
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN');

if (!GITHUB_TOKEN) {
  console.warn('GitHub token not configured - some functions may fail');
}

// Create Inngest client for production
const inngest = new Inngest({
  id: INNGEST_APP_ID,
  isDev: false, // Force production mode for proper request signing
  eventKey: INNGEST_EVENT_KEY,
  signingKey: INNGEST_SIGNING_KEY,
});

// Import function creators
import { createCaptureRepositorySyncGraphQL, createClassifySingleRepository } from './functions.ts';
import {
  captureIssueComments,
  capturePrComments,
  capturePrDetails,
  capturePrDetailsGraphQL,
  capturePrReviews,
  captureRepositoryIssues,
  captureRepositorySync,
  classifyRepositorySize,
  discoverNewRepository,
} from './inngest-functions.ts';

// Test function to verify connection
const testFunction = inngest.createFunction(
  { id: 'prod-test-function' },
  { event: 'test/prod.hello' },
  async ({ event, step }) => {
    console.log('Production test function executed!', event);

    await step.run('log-environment', async () => {
      console.log('Environment:', {
        hasEventKey: !!INNGEST_EVENT_KEY,
        hasSigningKey: !!INNGEST_SIGNING_KEY,
        hasGithubToken: !!GITHUB_TOKEN,
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseServiceKey,
      });
      return { logged: true };
    });

    return {
      message: 'Hello from Production Inngest on Supabase Edge!',
      timestamp: new Date().toISOString(),
      environment: 'supabase-edge-production',
      data: event.data,
    };
  },
);

// Create production functions using our configured client
const captureRepositorySyncGraphQL = createCaptureRepositorySyncGraphQL(inngest);
const classifySingleRepository = createClassifySingleRepository(inngest);

// Create the Inngest handler
const inngestHandler = new InngestCommHandler({
  frameworkName: 'deno',
  appId: INNGEST_APP_ID,
  signingKey: INNGEST_SIGNING_KEY,
  serveHost: Deno.env.get('SUPABASE_URL')?.replace('https://', '').split('.')[0] + '.supabase.co',
  servePath: '/functions/v1/inngest-prod',
  client: inngest,
  functions: [
    testFunction,
    // GraphQL functions (preferred)
    captureRepositorySyncGraphQL,
    capturePrDetailsGraphQL,
    // REST functions
    capturePrDetails,
    capturePrReviews,
    capturePrComments,
    captureIssueComments,
    captureRepositoryIssues,
    captureRepositorySync,
    // Classification functions
    classifySingleRepository,
    classifyRepositorySize,
    // Discovery function
    discoverNewRepository,
  ],
});

serve(async (req: Request) => {
  const url = new URL(req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        // Add Inngest-specific headers
        'Access-Control-Allow-Headers': `${
          corsHeaders['Access-Control-Allow-Headers']
        }, x-inngest-signature, X-Inngest-Signature, x-inngest-sdk, X-Inngest-SDK`,
      },
    });
  }

  // Handle HEAD requests (Inngest health checks)
  if (req.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    // Handle GET requests with a status page
    if (req.method === 'GET' && !url.searchParams.has('fnId')) {
      return new Response(
        JSON.stringify(
          {
            message: 'Inngest Production endpoint (Supabase Edge)',
            status: 'active',
            endpoint: '/functions/v1/inngest-prod',
            environment: {
              runtime: 'deno',
              platform: 'supabase-edge',
              hasEventKey: !!INNGEST_EVENT_KEY,
              hasSigningKey: !!INNGEST_SIGNING_KEY,
              hasGithubToken: !!GITHUB_TOKEN,
            },
            functions: [
              { id: 'prod-test-function', event: 'test/prod.hello' },
              { id: 'capture-repository-sync-graphql', event: 'capture/repository.sync.graphql' },
              { id: 'capture-pr-details-graphql', event: 'capture/pr.details.graphql' },
              { id: 'capture-pr-details', event: 'capture/pr.details' },
              { id: 'capture-pr-reviews', event: 'capture/pr.reviews' },
              { id: 'capture-pr-comments', event: 'capture/pr.comments' },
              { id: 'capture-issue-comments', event: 'capture/issue.comments' },
              { id: 'capture-repository-issues', event: 'capture/repository.issues' },
              { id: 'capture-repository-sync', event: 'capture/repository.sync' },
              { id: 'classify-single-repository', event: 'classify/repository.single' },
              { id: 'classify-repository-size', event: 'classify/repository.size' },
              { id: 'discover-new-repository', event: 'discover/repository.new' },
            ],
            usage: {
              testEvent:
                'Send POST: { "name": "test/prod.hello", "data": { "message": "Hello!" } }',
              syncEvent:
                'Send POST: { "name": "capture/repository.sync.graphql", "data": { "repositoryId": "123", "days": 30 } }',
              classifyEvent:
                'Send POST: { "name": "classify/repository.single", "data": { "repositoryId": "123", "owner": "owner", "repo": "repo" } }',
            },
            cors: {
              enabled: true,
              headers: Object.keys(corsHeaders),
            },
          },
          null,
          2,
        ),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        },
      );
    }

    // Handle Inngest webhook requests
    const response = await inngestHandler.serve(req);

    // Add CORS headers to the response
    const corsResponse = new Response(response.body, {
      status: response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        ...corsHeaders,
      },
    });

    return corsResponse;
  } catch (error) {
    console.error('Error processing request:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        service: 'inngest-prod',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    );
  }
});
