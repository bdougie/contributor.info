// Test script to trigger the backfill-pr-stats function
// Run with: VITE_SUPABASE_URL=your_url VITE_SUPABASE_ANON_KEY=your_key node scripts/data-sync/backfill-pr-stats.js

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

async function runBackfill() {
  try {
    const url = `${SUPABASE_URL}/functions/v1/backfill-pr-stats?batch_size=5&max_batches=1`;

    console.log('Triggering backfill function...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.text();

    console.log('Response status:', response.status);
    console.log('Response:', result);

    if (response.ok) {
      const data = JSON.parse(result);
      console.log('✅ Backfill completed:', data);
    } else {
      console.error('❌ Backfill failed:', result);
    }
  } catch (error) {
    console.error('❌ Error running backfill:', error);
  }
}

runBackfill();
