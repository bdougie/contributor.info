import type { Context } from "@netlify/functions";
import { Inngest } from "inngest";

// Environment detection - treat deploy previews as production for signing
const isProduction = () => {
  const context = process.env.CONTEXT;
  const nodeEnv = process.env.NODE_ENV;
  
  // Deploy previews should use production mode for proper signing
  return context === 'production' || 
         context === 'deploy-preview' || 
         nodeEnv === 'production' ||
         process.env.NETLIFY === 'true'; // All Netlify environments use production mode
};

// Get production environment variables
const getProductionEnvVar = (key: string, fallbackKey?: string): string => {
  // For production, use production-specific keys first
  if (isProduction()) {
    return process.env[`INNGEST_PRODUCTION_${key}`] || process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
  }
  // For preview/dev, use existing keys
  return process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
};

// Create Inngest client with server-side keys
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: false, // Force production mode for proper request signing
  eventKey: getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  signingKey: getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
});

/**
 * API endpoint to handle repository discovery
 * This allows the frontend to trigger repository setup when a new repo is visited
 */
export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return new Response(JSON.stringify({ 
        error: 'Missing owner or repo',
        message: 'Please provide both owner and repo parameters' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate repository name format
    const validFormat = /^[a-zA-Z0-9-_.]+$/.test(owner) && /^[a-zA-Z0-9-_.]+$/.test(repo);
    if (!validFormat) {
      return new Response(JSON.stringify({ 
        error: 'Invalid repository format',
        message: 'Repository names can only contain letters, numbers, hyphens, underscores, and dots' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log environment info for debugging
    console.log("Repository Discovery - Environment:", {
      context: process.env.CONTEXT,
      isProduction: isProduction(),
      hasEventKey: !!getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
      hasSigningKey: !!getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY')
    });

    // Send discovery event to Inngest
    const result = await inngest.send({
      name: 'discover/repository.new',
      data: {
        owner,
        repo,
        source: 'user-discovery',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`Repository discovery initiated for ${owner}/${repo}`, result);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Discovery started for ${owner}/${repo}`,
      eventId: result.ids?.[0] || 'unknown'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to initiate repository discovery:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to start repository discovery. Please try again.' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/discover-repository"
};