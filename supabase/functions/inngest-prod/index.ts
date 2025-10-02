// Supabase Edge Function for Inngest webhook handling
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
const INNGEST_EVENT_KEY =
  Deno.env.get('INNGEST_EVENT_KEY') || Deno.env.get('INNGEST_PRODUCTION_EVENT_KEY');
const INNGEST_SIGNING_KEY =
  Deno.env.get('INNGEST_SIGNING_KEY') || Deno.env.get('INNGEST_PRODUCTION_SIGNING_KEY');

// Ensure GitHub token is available
const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN');

if (!GITHUB_TOKEN) {
  console.warn('GitHub token not configured - some functions may fail');
}

console.log('Inngest Supabase Edge Function starting...');
console.log('Configuration:', {
  appId: INNGEST_APP_ID,
  hasEventKey: !!INNGEST_EVENT_KEY,
  hasSigningKey: !!INNGEST_SIGNING_KEY,
  hasGithubToken: !!GITHUB_TOKEN,
  hasSupabaseUrl: !!supabaseUrl,
  hasSupabaseKey: !!supabaseServiceKey,
});

// Create Inngest client for production
const inngest = new Inngest({
  id: INNGEST_APP_ID,
  isDev: false, // Always production mode in Edge Functions
  eventKey: INNGEST_EVENT_KEY,
  signingKey: INNGEST_SIGNING_KEY,
});

// Import function creators
import { createCaptureRepositorySyncGraphQL, createClassifySingleRepository } from './functions.ts';
import {
  capturePrDetails,
  capturePrReviews,
  capturePrComments,
  captureIssueComments,
  captureRepositoryIssues,
  captureRepositorySync,
  capturePrDetailsGraphQL,
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
      console.log('Environment check completed');
      return { logged: true };
    });

    return {
      message: 'Hello from Production Inngest on Supabase Edge!',
      timestamp: new Date().toISOString(),
      environment: 'supabase-edge-production',
      data: event.data,
    };
  }
);

// Create a simple PR activity update function
const updatePrActivity = inngest.createFunction(
  { id: 'update-pr-activity', name: 'Update PR Activity' },
  { event: 'pr.activity.update' },
  async ({ event, step }) => {
    console.log('PR activity update triggered:', event.data);
    return { success: true, message: 'PR activity update completed' };
  }
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
    // Other functions
    updatePrActivity,
    discoverNewRepository,
  ],
});

// Main HTTP server
serve(async (req: Request) => {
  const url = new URL(req.url);
  const method = req.method;

  console.log(`${method} ${url.pathname}${url.search}`);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Use InngestCommHandler to process the request
    const response = await inngestHandler.handleRequest(req);

    // Add CORS headers to the response
    if (response) {
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // Fallback if handler doesn't return a response
    return new Response(JSON.stringify({ error: 'No response from handler' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error handling request:', error);

    // Return a proper error response
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});