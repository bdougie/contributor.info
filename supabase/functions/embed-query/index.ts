// Supabase Edge Function: embed-query
// Generates MiniLM embeddings (384 dimensions) for a query string.
// Used by the chat function to perform RAG-based semantic search.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Disable local model caching (not available in Deno Deploy)
env.allowLocalModels = false;
env.useBrowserCache = false;

// Cache the pipeline across warm invocations
let embeddingPipeline: Awaited<ReturnType<typeof pipeline>> | null = null;

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
    );
  }
  return embeddingPipeline;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Require service_role key via Authorization header (exact match)
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!serviceKey || token !== serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const { text } = await req.json();
    if (typeof text !== 'string' || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or empty "text" field' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const start = Date.now();
    const embedder = await getEmbeddingPipeline();

    const output = await embedder(text.trim(), {
      pooling: 'mean',
      normalize: true,
    });

    // Extract the float array from the Tensor output
    const embedding: number[] = Array.from(output.data as Float32Array);
    const elapsed = Date.now() - start;

    return new Response(
      JSON.stringify({ embedding, dimensions: embedding.length, elapsed_ms: elapsed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('embed-query error: %s', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
