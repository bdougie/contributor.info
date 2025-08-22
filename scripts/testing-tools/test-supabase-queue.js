// Test script for the Supabase Edge Function queue-event endpoint
// Usage: VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node test-supabase-queue.js
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function testSupabaseQueueEndpoint() {
  console.log('Testing Supabase Edge Function queue-event endpoint...\n');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Required environment variables are not set');
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    console.error('Usage: VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node test-supabase-queue.js');
    console.error('Or source your .env file first: source .env && node test-supabase-queue.js');
    return;
  }
  
  const testEvent = {
    eventName: 'test/supabase.test',
    data: {
      message: 'Testing Supabase Edge Function for queue-event',
      timestamp: new Date().toISOString(),
      source: 'test-script',
      endpoint: 'supabase-edge-function'
    }
  };

  try {
    console.log('Sending event to:', `${SUPABASE_URL}/functions/v1/queue-event`);
    console.log('Event:', JSON.stringify(testEvent, null, 2));
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/queue-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(testEvent)
    });

    console.log('\nResponse status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Success! Event was queued via Supabase Edge Function');
      console.log('Event ID:', data.eventId);
      console.log('\n📊 Check the Inngest dashboard at http://localhost:8288 to see the event');
    } else {
      console.error('\n❌ Error:', data.error || data.message);
    }
  } catch (error) {
    console.error('\n❌ Failed to send event:', error.message);
    console.error('Make sure the Supabase Edge Function is deployed');
  }
}

// Run the test
testSupabaseQueueEndpoint();