// Standalone Supabase Edge Function for Inngest webhook handling
// This version has minimal dependencies to ensure it works properly

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { Inngest } from 'https://esm.sh/inngest@3.16.1';
import { InngestCommHandler } from 'https://esm.sh/inngest@3.16.1/components/InngestCommHandler';

// CORS headers for Inngest
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-inngest-signature, X-Inngest-Signature, x-inngest-sdk, X-Inngest-SDK, x-inngest-server-kind, X-Inngest-Server-Kind',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
};

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
  isDev: false,
  eventKey: INNGEST_EVENT_KEY,
  signingKey: INNGEST_SIGNING_KEY,
});

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

// Simple PR activity update function
const updatePrActivity = inngest.createFunction(
  { id: 'update-pr-activity', name: 'Update PR Activity' },
  { event: 'pr.activity.update' },
  async ({ event, step }) => {
    console.log('PR activity update triggered:', event.data);
    return { success: true, message: 'PR activity update completed' };
  }
);

// Placeholder functions for migration
const placeholderFunction = (id: string, name: string, eventName: string) =>
  inngest.createFunction(
    { id, name },
    { event: eventName },
    async ({ event }) => {
      console.log(`${name} triggered:`, event.data);
      return { success: true, message: `${name} placeholder executed`, data: event.data };
    }
  );

// Create placeholder functions for all expected Inngest functions
const functions = [
  testFunction,
  updatePrActivity,
  placeholderFunction('capture-pr-details', 'Capture PR Details', 'pr.details.capture'),
  placeholderFunction('capture-pr-details-graphql', 'Capture PR Details (GraphQL)', 'pr.details.capture.graphql'),
  placeholderFunction('capture-pr-reviews', 'Capture PR Reviews', 'pr.reviews.capture'),
  placeholderFunction('capture-pr-comments', 'Capture PR Comments', 'pr.comments.capture'),
  placeholderFunction('capture-issue-comments', 'Capture Issue Comments', 'issue.comments.capture'),
  placeholderFunction('capture-repository-issues', 'Capture Repository Issues', 'repository.issues.capture'),
  placeholderFunction('capture-repository-sync', 'Capture Repository Sync', 'repository.sync'),
  placeholderFunction('capture-repository-sync-graphql', 'Capture Repository Sync (GraphQL)', 'repository.sync.graphql'),
  placeholderFunction('classify-repository-size', 'Classify Repository Size', 'repository.size.classify'),
  placeholderFunction('classify-single-repository', 'Classify Single Repository', 'repository.single.classify'),
  placeholderFunction('discover-new-repository', 'Discover New Repository', 'repository.discover'),
];

// Create the Inngest handler
const inngestHandler = new InngestCommHandler({
  frameworkName: 'deno',
  appId: INNGEST_APP_ID,
  signingKey: INNGEST_SIGNING_KEY,
  serveHost: Deno.env.get('SUPABASE_URL')?.replace('https://', '').split('.')[0] + '.supabase.co',
  servePath: '/functions/v1/inngest-prod',
  client: inngest,
  functions,
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
  } catch (error: any) {
    console.error('Error handling request:', error);

    // Return a proper error response
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});