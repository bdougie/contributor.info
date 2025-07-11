// Production-ready Inngest function for Netlify
// Self-contained to avoid import issues with src directory
import { Inngest } from "inngest";
import { serve } from "inngest/netlify";
import { createClient } from '@supabase/supabase-js';
import type { Context } from "@netlify/functions";

// Environment detection
const isDevelopment = () => {
  const nodeEnv = process.env.NODE_ENV;
  const netlifyContext = process.env.CONTEXT;
  
  if (netlifyContext === 'production' || nodeEnv === 'production') {
    return false;
  }
  
  return nodeEnv !== 'production';
};

// Get environment variables directly from process.env
const getEnvVar = (key: string): string => {
  return process.env[key] || '';
};

// Create Inngest client
const inngest = new Inngest({ 
  id: getEnvVar('VITE_INNGEST_APP_ID') || 'contributor-info',
  isDev: isDevelopment(),
  eventKey: getEnvVar('INNGEST_EVENT_KEY') || 'dev-key',
  signingKey: getEnvVar('INNGEST_SIGNING_KEY'),
});

// Create Supabase client
const supabase = createClient(
  getEnvVar('VITE_SUPABASE_URL') || '',
  getEnvVar('VITE_SUPABASE_ANON_KEY') || ''
);

// Simple test function to verify it works
const testFunction = inngest.createFunction(
  { id: "test-function" },
  { event: "test/hello" },
  async ({ event, step }) => {
    console.log("Test function executed!", event);
    return { message: "Hello from Inngest Production!", timestamp: new Date().toISOString() };
  }
);

// Capture PR Details function (simplified version)
const capturePrDetails = inngest.createFunction(
  {
    id: "capture-pr-details",
    name: "Capture PR Details",
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: "capture/pr.details" },
  async ({ event, step }) => {
    const { repositoryId, prNumber, prId } = event.data;
    
    // Get repository details
    const repository = await step.run("get-repository", async () => {
      const { data, error } = await supabase
        .from('repositories')
        .select('owner, name')
        .eq('id', repositoryId)
        .single();

      if (error || !data) {
        throw new Error(`Repository not found: ${repositoryId}`);
      }
      return data;
    });

    // For now, just log and return success
    console.log(`Processing PR #${prNumber} in ${repository.owner}/${repository.name}`);
    
    return {
      success: true,
      repository: repository,
      prNumber: prNumber,
      message: "PR details captured (simplified version)"
    };
  }
);

// Create the serve handler
const inngestHandler = serve({
  client: inngest,
  functions: [
    testFunction,
    capturePrDetails,
    // Add other functions here as needed
  ],
  servePath: "/.netlify/functions/inngest-production",
});

// Export the Netlify handler
export default async (req: Request, context: Context) => {
  // Handle GET requests with a status page
  if (req.method === "GET" && !req.url.includes("?")) {
    return new Response(JSON.stringify({
      message: "Inngest Production endpoint is active",
      endpoint: "/.netlify/functions/inngest-production",
      functions: [
        "test-function",
        "capture-pr-details"
      ],
      environment: {
        context: process.env.CONTEXT || "unknown",
        hasEventKey: !!getEnvVar('INNGEST_EVENT_KEY'),
        hasSigningKey: !!getEnvVar('INNGEST_SIGNING_KEY'),
        hasSupabase: !!getEnvVar('VITE_SUPABASE_URL') && !!getEnvVar('VITE_SUPABASE_ANON_KEY'),
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Pass all other requests to Inngest
  return inngestHandler(req, context);
};

// Also export as handler for compatibility
export const handler = inngestHandler;