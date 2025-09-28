// Test script for the /api/queue-event endpoint
async function testQueueEndpoint() {
  console.log('Testing /api/queue-event endpoint...\n');

  const testEvent = {
    eventName: 'test/manual.test',
    data: {
      message: 'Testing queue-event endpoint locally',
      timestamp: new Date().toISOString(),
      source: 'test-script',
    },
  };

  try {
    console.log('Sending event:', JSON.stringify(testEvent, null, 2));

    const response = await fetch('http://localhost:8888/api/queue-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEvent),
    });

    console.log('\nResponse status:', response.status, response.statusText);

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Success! Event was queued successfully');
      console.log('Event ID:', data.eventId);
      console.log('\n📊 Check the Inngest dashboard at http://localhost:8288 to see the event');
    } else {
      console.error('\n❌ Error:', data.error || data.message);
    }
  } catch (error) {
    console.error('\n❌ Failed to send event:', error.message);
    console.error('Make sure Netlify dev server is running on port 8888');
  }
}

// Run the test
testQueueEndpoint();
