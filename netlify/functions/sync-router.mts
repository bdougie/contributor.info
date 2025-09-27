// Hybrid routing function for repository sync operations
// Routes to Supabase Edge Functions for long-running operations
// Keeps quick operations on Netlify for better response times

import type { Handler } from '@netlify/functions';
import { inngest } from '../../src/lib/inngest/client';
import { createClient } from '@supabase/supabase-js';

// Environment configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USE_SUPABASE_FUNCTIONS = process.env.USE_SUPABASE_FUNCTIONS === 'true';

// Initialize Supabase client when available
const supabase = SUPABASE_URL && (SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY!)
  : null;

// Repository size thresholds
const LARGE_REPO_THRESHOLD = 1000; // PRs
const MEDIUM_REPO_THRESHOLD = 500;

interface SyncRequest {
  action: 'sync' | 'sync-graphql' | 'batch-pr' | 'quick-update';
  repository: string; // owner/name format
  options?: {
    fullSync?: boolean;
    daysLimit?: number;
    prNumbers?: number[];
    forceSupabase?: boolean; // Override routing logic
    forceNetlify?: boolean; // Override routing logic
  };
}

// Known large repositories that should always use Supabase
const LARGE_REPOS = [
  'pytorch/pytorch',
  'tensorflow/tensorflow',
  'kubernetes/kubernetes',
  'facebook/react',
  'microsoft/vscode',
  'torvalds/linux',
];

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const request = JSON.parse(event.body || '{}') as SyncRequest;
    const { action, repository, options = {} } = request;

    if (!repository) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Repository is required' }),
      };
    }

    // Validate repository format
    if (!repository.includes('/') || repository.split('/').length !== 2) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid repository format',
          details: 'Repository must be in format: owner/name'
        }),
      };
    }

    const [owner, name] = repository.split('/');
    if (!owner || !name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid repository format',
          details: 'Both owner and name are required'
        }),
      };
    }

    // Determine routing strategy
    const useSupabase = shouldUseSupabase(repository, action, options);

    if (useSupabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
      // Route to Supabase Edge Function
      return await routeToSupabase(action, repository, options);
    } else {
      // Use Netlify/Inngest for quick operations
      return await routeToInngest(action, repository, options);
    }
  } catch (error) {
    console.error('Sync router error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

// Determine if operation should use Supabase Edge Functions
function shouldUseSupabase(
  repository: string,
  action: string,
  options: any
): boolean {
  // Check manual overrides
  if (options.forceSupabase) return true;
  if (options.forceNetlify) return false;
  
  // Always use Supabase for known large repos
  if (LARGE_REPOS.includes(repository)) return true;
  
  // Use Supabase for full syncs
  if (options.fullSync) return true;
  
  // Use Supabase for batch operations over 50 PRs
  if (action === 'batch-pr' && options.prNumbers?.length > 50) return true;
  
  // Use Supabase for sync operations with large date ranges
  if (options.daysLimit && options.daysLimit > 90) return true;
  
  // Use Supabase if explicitly enabled
  if (USE_SUPABASE_FUNCTIONS) return true;
  
  // Default to Netlify for quick operations
  return false;
}

// Route to Supabase Edge Functions with job tracking
async function routeToSupabase(
  action: string,
  repository: string,
  options: any
) {
  const [owner, name] = repository.split('/');

  // Map action to job type for background_jobs table
  const jobTypeMap: Record<string, string> = {
    'sync': 'sync-router/repository.sync',
    'sync-graphql': 'sync-router/repository.sync.graphql',
    'batch-pr': 'sync-router/pr.details.batch',
  };

  const jobType = jobTypeMap[action];
  if (!jobType) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Unknown action: ${action}` }),
    };
  }

  try {
    // If we have Supabase client with service key, use job tracking
    if (supabase && SUPABASE_SERVICE_KEY) {
      // Look up repository ID if available
      const { data: repoData } = await supabase
        .from('repositories')
        .select('id')
        .eq('full_name', repository)
        .single();

      // Create job record in background_jobs table
      const { data: job, error: jobError } = await supabase
        .from('background_jobs')
        .insert({
          type: jobType,
          payload: {
            owner,
            name,
            repository,
            ...options,
          },
          status: 'queued',
          repository_id: repoData?.id || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobError) {
        console.error('Error creating job record:', jobError);
        // Fall back to direct call if job creation fails
        return await directSupabaseCall(action, repository, options);
      }

      // Trigger process-job function asynchronously
      const processUrl = `${SUPABASE_URL}/functions/v1/process-job`;

      // Fire and forget - don't await
      fetch(processUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ jobId: job.id }),
      }).catch(error => {
        console.error('Error triggering process-job:', error);
      });

      console.log(`Job queued for processing:`, {
        jobId: job.id,
        type: jobType,
        repository,
      });

      return {
        statusCode: 202,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          message: 'Operation queued for processing',
          jobId: job.id,
          type: jobType,
          router: 'supabase-jobs',
          repository,
        }),
      };
    } else {
      // No service key, use direct Supabase function call (legacy mode)
      return await directSupabaseCall(action, repository, options);
    }
  } catch (error) {
    console.error(`Supabase routing error:`, error);

    // Fallback to Inngest if Supabase fails
    console.log('Falling back to Inngest due to Supabase error');
    return await routeToInngest(action, repository, options);
  }
}

// Direct Supabase function call (legacy mode without job tracking)
async function directSupabaseCall(
  action: string,
  repository: string,
  options: any
) {
  const [owner, name] = repository.split('/');

  // Map action to Supabase function endpoint
  const endpoints: Record<string, string> = {
    'sync': 'repository-sync',
    'sync-graphql': 'repository-sync-graphql',
    'batch-pr': 'pr-details-batch',
  };

  const endpoint = endpoints[action];
  const url = `${SUPABASE_URL}/functions/v1/${endpoint}`;
  const body = {
    owner,
    name,
    repository,
    ...options,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json();

  console.log(`Direct Supabase call completed:`, {
    endpoint,
    repository,
    status: response.status,
  });

  return {
    statusCode: response.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...result,
      router: 'supabase-direct',
      function: endpoint,
    }),
  };
}

// Route to Inngest (existing Netlify functions)
async function routeToInngest(
  action: string,
  repository: string,
  options: any
) {
  const [owner, name] = repository.split('/');
  
  try {
    // Map actions to Inngest events
    const eventMap: Record<string, string> = {
      'sync': 'repository.sync.requested',
      'sync-graphql': 'repository.sync.graphql.requested',
      'batch-pr': 'pr.details.batch.requested',
      'quick-update': 'repository.quick.update',
    };
    
    const eventName = eventMap[action];
    if (!eventName) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Unknown action: ${action}` }),
      };
    }
    
    // Send event to Inngest
    const result = await inngest.send({
      name: eventName,
      data: {
        owner,
        name,
        repository,
        ...options,
      },
    });
    
    console.log(`Inngest event sent:`, {
      event: eventName,
      repository,
      id: result.ids,
    });
    
    return {
      statusCode: 202,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Sync queued for processing',
        router: 'inngest',
        eventId: result.ids[0],
        repository,
      }),
    };
  } catch (error) {
    console.error('Inngest routing error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to queue sync',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

// Health check endpoint
export const health = async () => {
  const supabaseAvailable = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const jobTrackingEnabled = !!(supabase && SUPABASE_SERVICE_KEY);

  // Get job queue status if available
  let jobStats = null;
  if (jobTrackingEnabled && supabase) {
    try {
      const { data } = await supabase
        .rpc('get_job_statistics_summary');
      jobStats = data;
    } catch (error) {
      console.error('Error fetching job stats:', error);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'healthy',
      router: 'sync-router',
      supabaseEnabled: supabaseAvailable,
      jobTrackingEnabled,
      useSupabaseFunctions: USE_SUPABASE_FUNCTIONS,
      jobStats,
      timestamp: new Date().toISOString(),
    }),
  };
};