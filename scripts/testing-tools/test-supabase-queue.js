// Test script for the Supabase Edge Function queue-event endpoint
// Usage: VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node test-supabase-queue.js
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function testSupabaseQueueEndpoint() {
  console.log('Testing Supabase Edge Function queue-event endpoint...\n');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Required environment variables are not set');
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    console.error(
      'Usage: VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node test-supabase-queue.js'
    );
    console.error('Or source your .env file first: source .env && node test-supabase-queue.js');
    return;
  }

  const testEvent = {
    eventName: 'test/supabase.test',
    data: {
      message: 'Testing Supabase Edge Function for queue-event',
      timestamp: new Date().toISOString(),
      source: 'test-script',
      endpoint: 'supabase-edge-function',
    },
  };

  // Build the endpoint URL dynamically based on environment
  const queueEventUrl = `${SUPABASE_URL}/functions/v1/queue-event`;

  try {
    console.log('Sending event to:', queueEventUrl);
    console.log('Event:', JSON.stringify(testEvent, null, 2));

    const response = await fetch(queueEventUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(testEvent),
    });

    console.log('\nResponse status:', response.status, response.statusText);

    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('Response data:', JSON.stringify(data, null, 2));

      if (response.ok) {
        console.log('\n✅ Success! Event was queued via Supabase Edge Function');
        console.log('Event ID:', data.eventId);
        console.log('\n📊 Check the Inngest dashboard at http://localhost:8288 to see the event');
      } else {
        console.error('\n❌ Error:', data.error || data.message);
      }
    } else {
      // Handle non-JSON responses
      const text = await response.text();
      if (response.ok) {
        console.log('\n✅ Success! Event was queued via Supabase Edge Function');
        console.log('Response:', text);
      } else {
        console.error('\n❌ Error: Non-JSON response received');
        console.error('Response:', text);
      }
    }
  } catch (error) {
    console.error('\n❌ Failed to send event:', error.message);
    console.error('Make sure the Supabase Edge Function is deployed and running');
    console.error('Check the Supabase dashboard for function logs and status');
  }
}

// Run the test
testSupabaseQueueEndpoint();
