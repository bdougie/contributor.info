/**
 * Test Embeddings Function
 * Tests MiniLM embedding generation without storing in database
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createResponse, createErrorResponse } from '../_shared/responses.ts';
import { generateEmbedding, prepareTextForEmbedding } from '../_shared/embeddings.ts';

serve(async (req) => {
  try {
    // Parse request body or use default test text
    const body = req.method === 'POST' ? await req.json() : {};
    const testText = body.text || 'Issue: Test issue for embedding generation\n\nThis is a test body to verify MiniLM embeddings are working correctly.';

    console.log('[Test Embeddings] Generating embedding for text:', testText.substring(0, 100));

    const startTime = Date.now();
    const embedding = await generateEmbedding(testText);
    const elapsed = Date.now() - startTime;

    console.log(`[Test Embeddings] Generated ${embedding.length}-dimensional embedding in ${elapsed}ms`);

    return createResponse({
      success: true,
      message: 'MiniLM embedding generated successfully',
      embedding_dimensions: embedding.length,
      generation_time_ms: elapsed,
      sample_values: embedding.slice(0, 5),
      text_length: testText.length,
      model: 'Xenova/all-MiniLM-L6-v2',
    });
  } catch (error) {
    console.error('[Test Embeddings] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Unknown error',
      500
    );
  }
});
