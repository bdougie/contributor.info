import { inngest } from './src/lib/inngest/client.js';

// Test sending an event to Inngest
async function testInngest() {
  console.log('Testing Inngest connection...');
  
  try {
    const result = await inngest.send({
      name: 'test/local.hello',
      data: {
        message: 'Testing from Node.js',
        timestamp: new Date().toISOString()
      }
    });
    
    console.log('✅ Event sent successfully!');
    console.log('Result:', result);
    console.log('\nNow check http://localhost:8288/runs to see if the event was processed');
  } catch (error) {
    console.error('❌ Failed to send event:', error.message);
    console.error('Make sure Inngest dev server is running at http://localhost:8288');
  }
}

testInngest();