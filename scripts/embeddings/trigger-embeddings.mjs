#!/usr/bin/env node

/**
 * Manually trigger the embeddings computation function via Inngest API
 * Usage: node scripts/embeddings/trigger-embeddings.mjs
 */

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY;
const INNGEST_API_URL = 'https://inn.gs/e';

async function triggerEmbeddings() {
  if (!INNGEST_EVENT_KEY) {
    console.error(
      '❌ Error: INNGEST_EVENT_KEY or INNGEST_PRODUCTION_EVENT_KEY environment variable is required'
    );
    console.error("   Export it: export INNGEST_EVENT_KEY='your-key'");
    process.exit(1);
  }

  console.log('🚀 Triggering embeddings computation via Inngest API...');

  try {
    const response = await fetch(`${INNGEST_API_URL}/${INNGEST_EVENT_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    console.log('\n📊 Monitor at: https://app.inngest.com');
    console.log('\n📊 Check status with SQL:');
    console.log('  SELECT * FROM embedding_jobs ORDER BY created_at DESC LIMIT 1;');
  } catch (error) {
    console.error(`❌ Error: %s`, error.message);
    process.exit(1);
  }
}

triggerEmbeddings();
