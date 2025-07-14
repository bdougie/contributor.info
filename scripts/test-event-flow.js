import { Inngest } from 'inngest';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testing Event Flow\n');

// Create client matching local settings
const inngest = new Inngest({
  id: 'contributor-info',
  isDev: true,
  eventKey: process.env.INNGEST_EVENT_KEY || 'local-dev-key'
});

async function testEventFlow() {
  // 1. Test direct event sending
  console.log('1️⃣ Testing direct event send to Inngest Dev Server...');
  try {
    const result = await inngest.send({
      name: 'test/local.hello',
      data: { 
        message: 'Direct test',
        timestamp: new Date().toISOString()
      }
    });
    console.log('✅ Direct send successful:', result.ids?.[0]);
  } catch (error) {
    console.log('❌ Direct send failed:', error.message);
  }

  // 2. Test via queue-event endpoint (how browser sends)
  console.log('\n2️⃣ Testing via queue-event endpoint...');
  try {
    const response = await fetch('http://localhost:8888/.netlify/functions/queue-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'test/local.hello',
        data: { 
          message: 'Queue endpoint test',
          timestamp: new Date().toISOString()
        }
      })
    });
    const result = await response.json();
    console.log('✅ Queue endpoint:', result.success ? 'Success' : 'Failed', result);
  } catch (error) {
    console.log('❌ Queue endpoint failed:', error.message);
  }

  // 3. Test production events that should work now
  console.log('\n3️⃣ Testing production events...');
  try {
    const result = await inngest.send({
      name: 'capture/repository.sync.graphql',
      data: {
        repositoryId: 'test-123',
        days: 7,
        priority: 'medium',
        reason: 'test'
      }
    });
    console.log('✅ Production event sent:', result.ids?.[0]);
  } catch (error) {
    console.log('❌ Production event failed:', error.message);
  }

  console.log('\n📊 Check these URLs:');
  console.log('- Events: http://localhost:8288/stream');
  console.log('- Runs: http://localhost:8288/runs');
  console.log('- Functions: http://localhost:8288/functions');
  
  console.log('\n💡 If events aren\'t showing:');
  console.log('1. Clear browser cache and reload the app');
  console.log('2. Check browser console for errors');
  console.log('3. Verify INNGEST_EVENT_KEY in .env matches dev server');
}

testEventFlow();