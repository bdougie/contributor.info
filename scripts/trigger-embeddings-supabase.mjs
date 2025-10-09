#!/usr/bin/env node

/**
 * Directly trigger the computeEmbeddings function in Supabase
 * Bypasses Inngest registration issues
 */

const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/inngest-prod`;

async function triggerEmbeddings() {
  console.log('🚀 Triggering Supabase compute-embeddings...');

  try {
    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        event: {
          name: 'embeddings/compute.requested',
          data: {},
        },
      }),
    });

    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log('Response:', text);

    if (!response.ok) {
      console.error('❌ Failed');
      process.exit(1);
    }

    console.log('✅ Successfully triggered');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

triggerEmbeddings();
