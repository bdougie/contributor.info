#!/usr/bin/env node

/**
 * Simple embeddings runner - processes items directly with OpenAI
 * No Inngest required
 */

import 'dotenv/config';

const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co';

async function runEmbeddings() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

  if (!serviceKey || !openaiKey) {
    console.error('❌ Missing required environment variables:');
    if (!serviceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    if (!openaiKey) console.error('  - OPENAI_API_KEY or VITE_OPENAI_API_KEY');
    process.exit(1);
  }

  console.log('🚀 Processing embeddings directly (no Inngest)...\n');

  try {
    // Get items needing embeddings
    const itemsResp = await fetch(`${SUPABASE_URL}/rest/v1/items_needing_embeddings?limit=50`, {
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

    let processed = 0;
    let errors = 0;

    for (const item of items) {
      try {
        console.log(`\n📝 Processing: ${item.title?.substring(0, 60)}...`);

        // Generate embedding
        const content = `${item.title || ''}\\n${item.body || ''}`;
        const embeddingResp = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            dimensions: 384,
            input: content.substring(0, 8000), // Limit token count
          }),
        });

        if (!embeddingResp.ok) {
          throw new Error(`OpenAI API error: ${embeddingResp.status}`);
        }

        const embeddingData = await embeddingResp.json();
        const embedding = embeddingData.data[0].embedding;

        // Update the item
        const table =
          item.item_type === 'issue'
            ? 'issues'
            : item.item_type === 'pull_request'
              ? 'pull_requests'
              : 'discussions';

        const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${item.id}`, {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            embedding: `[${embedding.join(',')}]`,
            embedding_generated_at: new Date().toISOString(),
          }),
        });

        if (!updateResp.ok) {
          const errorText = await updateResp.text();
          throw new Error(`Update failed: ${updateResp.status} - ${errorText}`);
        }

        console.log(`   ✅ Done`);
        processed++;

        // Rate limit: wait 100ms between requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Errors: ${errors}`);
    console.log(`\n✅ Done!`);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

runEmbeddings();
