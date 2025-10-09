#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Manually trigger the embeddings computation function
 * Usage: deno run --allow-net --allow-env scripts/trigger-embeddings.ts
 */

const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const INNGEST_ENDPOINT = `${SUPABASE_URL}/functions/v1/inngest-prod`;

async function triggerEmbeddings() {
  console.log('🚀 Triggering embeddings computation...');

  const response = await fetch(INNGEST_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'embeddings/compute.requested',
      data: {
        // Optional: specify repositoryId to target specific repo
        // repositoryId: 'your-repo-id',
      },
      ts: Date.now(),
    }),
  });

  const text = await response.text();

  if (!response.ok) {
    console.error(`❌ Failed to trigger: ${response.status}`);
    console.error(text);
    Deno.exit(1);
  }

  console.log('✅ Successfully triggered embeddings computation');
  console.log('Response:', text);
  console.log('\nCheck status with:');
  console.log('  SELECT * FROM embedding_jobs ORDER BY created_at DESC LIMIT 1;');
}

triggerEmbeddings();
