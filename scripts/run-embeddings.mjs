#!/usr/bin/env node

/**
 * Manually run embeddings computation
 * Calls the Supabase function directly to compute embeddings for items
 *
 * Usage:
 *   node scripts/run-embeddings.mjs
 *
 * Required env vars:
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key from Supabase dashboard
 */

const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/inngest-prod`;

async function runEmbeddings() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    console.error(
      'Get it from: https://supabase.com/dashboard/project/egcxzonpmmcirmgqdrla/settings/api'
    );
    process.exit(1);
  }

  console.log('🚀 Running embeddings computation...');
  console.log('📍 Endpoint:', FUNCTION_URL);

  try {
    // Check items needing embeddings
    console.log('\n📊 Checking items needing embeddings...');
    const itemsResponse = await fetch(`${SUPABASE_URL}/rest/v1/items_needing_embeddings?limit=10`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    const items = await itemsResponse.json();
    console.log(`Found ${items?.length || 0} items needing embeddings`);

    if (!items || items.length === 0) {
      console.log('✅ No items need embeddings. All done!');
      return;
    }

    console.log('\n📝 Sample items:');
    items.slice(0, 3).forEach((item, i) => {
      console.log(`  ${i + 1}. [${item.type}] ${item.title?.substring(0, 50)}...`);
    });

    // Invoke the function directly via POST
    console.log('\n🔧 Triggering embeddings computation...');

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        name: 'embeddings/compute.requested',
        data: {
          forceRegenerate: false,
          itemTypes: ['issues', 'pull_requests', 'discussions'],
        },
        ts: Date.now(),
      }),
    });

    const text = await response.text();
    console.log(`\nStatus: ${response.status}`);

    if (!response.ok) {
      console.error('❌ Failed to trigger embeddings');
      console.error('Response:', text);
      process.exit(1);
    }

    console.log('✅ Successfully triggered embeddings computation');
    console.log('Response:', text);

    // Check job status
    console.log('\n📊 Checking job status...');
    const jobsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/embedding_jobs?order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );

    const jobs = await jobsResponse.json();
    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      console.log(`\nJob ID: ${job.id}`);
      console.log(`Status: ${job.status}`);
      console.log(`Progress: ${job.items_processed}/${job.items_total}`);
      console.log(`Created: ${job.created_at}`);
    }

    console.log('\n✅ Embeddings job started!');
    console.log('\nMonitor with SQL:');
    console.log('  SELECT * FROM embedding_jobs ORDER BY created_at DESC LIMIT 1;');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runEmbeddings();
