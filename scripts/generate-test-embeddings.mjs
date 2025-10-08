#!/usr/bin/env node

/**
 * Generate embeddings for specific test items
 * Usage: node scripts/generate-test-embeddings.mjs
 */

import 'dotenv/config';

const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co';

async function generateTestEmbeddings() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

  if (!serviceKey || !openaiKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  const testItems = [
    { type: 'discussion', ids: ['D_kwDOJm0kOc4AiREw', 'D_kwDOJm0kOc4AiTSy'] },
    { type: 'issue', ids: ['0c65aa81-52ae-439d-bb2d-3055ef968cb1'] },
  ];

  console.log('🚀 Generating embeddings for test items...\n');

  for (const { type, ids } of testItems) {
    const table =
      type === 'issue' ? 'issues' : type === 'pull_request' ? 'pull_requests' : 'discussions';

    for (const id of ids) {
      try {
        // Fetch item
        const itemResp = await fetch(
          `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}&select=id,title,body`,
          {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
            },
          }
        );

        const items = await itemResp.json();
        if (items.length === 0) {
          console.log(`⚠️  ${type} ${id} not found`);
          continue;
        }

        const item = items[0];
        console.log(`📝 Processing: ${item.title?.substring(0, 60)}...`);

        // All tables now use 384 dimensions (MiniLM)
        const dimensions = 384;
        const content = `${item.title || ''}\n${item.body || ''}`;
        const embeddingResp = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            dimensions,
            input: content.substring(0, 8000),
          }),
        });

        if (!embeddingResp.ok) {
          throw new Error(`OpenAI API error: ${embeddingResp.status}`);
        }

        const embeddingData = await embeddingResp.json();
        const embedding = embeddingData.data[0].embedding;

        // Update the item
        const updateResp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
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

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }
  }

  console.log('\n✅ Test embeddings generated!');
}

generateTestEmbeddings();
