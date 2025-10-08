#!/usr/bin/env node

/**
 * Directly call the compute embeddings function logic
 * Bypasses Inngest entirely and calls Supabase function as a regular HTTP endpoint
 */

import 'dotenv/config';

const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co';

async function runEmbeddingsDirect() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🚀 Calling embeddings function directly...\n');

  try {
    // Get items needing embeddings
    const itemsResp = await fetch(`${SUPABASE_URL}/rest/v1/items_needing_embeddings?limit=5`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    const items = await itemsResp.json();
    console.log(`📊 Found ${items.length} items needing embeddings\n`);

    if (items.length === 0) {
      console.log('✅ No items need embeddings!');
      return;
    }

    items.forEach((item, i) => {
      console.log(`${i + 1}. [${item.type || 'unknown'}] ${item.title?.substring(0, 60)}`);
    });

    console.log('\n🔧 Processing embeddings via Supabase function...\n');

    // Call function with proper Inngest event format
    const response = await fetch(`${SUPABASE_URL}/functions/v1/inngest-prod`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        event: 'embeddings/compute.requested',
        data: {},
        v: '2025-01-01.1',
      }),
    });

    const result = await response.text();

    console.log(`Status: ${response.status}`);
    console.log(`Response: ${result}\n`);

    if (response.ok) {
      console.log('✅ Embeddings triggered successfully!\n');

      // Check job
      const jobResp = await fetch(
        `${SUPABASE_URL}/rest/v1/embedding_jobs?order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );

      const jobs = await jobResp.json();
      if (jobs[0]) {
        console.log('📊 Latest job:');
        console.log(`   ID: ${jobs[0].id}`);
        console.log(`   Status: ${jobs[0].status}`);
        console.log(`   Progress: ${jobs[0].items_processed}/${jobs[0].items_total}`);
      }
    } else {
      console.error('❌ Failed');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

runEmbeddingsDirect();
