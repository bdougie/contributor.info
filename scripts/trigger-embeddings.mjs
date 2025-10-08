#!/usr/bin/env node

/**
 * Manually trigger the embeddings computation function
 * Usage: node scripts/trigger-embeddings.mjs
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INNGEST_ENDPOINT = `${SUPABASE_URL}/functions/v1/inngest-prod`;

async function triggerEmbeddings() {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
  }

  console.log('🚀 Triggering embeddings computation...');

  try {
    const response = await fetch(INNGEST_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        name: 'embeddings/compute.requested',
        data: {},
        ts: Date.now(),
      }),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(`❌ Failed to trigger: ${response.status}`);
      console.error(text);
      process.exit(1);
    }

    console.log('✅ Successfully triggered embeddings computation');
    console.log('Response:', text);
    console.log('\n📊 Check status with SQL:');
    console.log('  SELECT * FROM embedding_jobs ORDER BY created_at DESC LIMIT 1;');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

triggerEmbeddings();
