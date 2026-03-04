import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '../../src/lib/inngest/client';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...headers, Allow: 'POST' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { owner, repo } = body;

    if (!owner || !repo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'owner and repo are required' }),
      };
    }

    // Look up repository ID
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Database not configured' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (!repoData) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Repository not tracked' }),
      };
    }

    const result = await inngest.send({
      name: 'capture/repository.events',
      data: { repositoryId: repoData.id },
    });

    console.log('Triggered event backfill for %s/%s (id: %s)', owner, repo, repoData.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, result }),
    };
  } catch (error) {
    console.error('[trigger-event-backfill] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', message }),
    };
  }
};
