// Test script for the Supabase Edge Function queue-event endpoint
const SUPABASE_URL = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnY3h6b25wbW1jaXJtZ3FkcmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxODAzNzEsImV4cCI6MjA2Nzc1NjM3MX0.SY1LMsRFyrBtHiZfgDhXD9ZlKl37-L7Uar4HnyDgw24';

async function testSupabaseQueueEndpoint() {
  console.log('Testing Supabase Edge Function queue-event endpoint...\n');
  
  if (!SUPABASE_ANON_KEY) {
    console.error('❌ SUPABASE_ANON_KEY environment variable is not set');
    console.error('Please set it in your .env file or export it');
    console.error('Looking for SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY');
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