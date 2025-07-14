import dotenv from 'dotenv';
import { Inngest } from 'inngest';

dotenv.config();

// Create local Inngest client
const inngest = new Inngest({
  id: 'contributor-info',
  isDev: true,
  eventKey: process.env.INNGEST_EVENT_KEY || 'local-dev-key'
});

async function sendTestEvents() {
  console.log('🧪 Sending Test Events to Local Inngest\n');

  const events = [
    {
      name: 'test/local.hello',
      data: {
        message: 'Testing local Inngest setup',
        timestamp: new Date().toISOString()
      }
    },
    {
      name: 'capture/repository.sync.graphql',
      data: {
        repositoryId: 'f4b8c464-e506-5612-9ca8-0c96e7d8bbf0', // contributor.info
        days: 7,
        priority: 'medium',
        reason: 'local-test'
      }
    },
    {
      name: 'classify/repository.single',
      data: {
        repositoryId: 'f4b8c464-e506-5612-9ca8-0c96e7d8bbf0',
        owner: 'contributor',
        repo: 'contributor.info'
      }
    }
  ];

  for (const event of events) {
    try {
      console.log(`📤 Sending event: ${event.name}`);
      const result = await inngest.send(event);
      console.log(`✅ Success - Event ID: ${result.ids?.[0]}`);
      console.log(`   Data: ${JSON.stringify(event.data, null, 2)}\n`);
    } catch (error) {
      console.log(`❌ Failed to send ${event.name}: ${error.message}\n`);
    }
  }

  console.log('📊 Next Steps:');
  console.log('1. Check http://localhost:8288/stream to see the events');
  console.log('2. Check http://localhost:8288/runs to see function runs');
  console.log('3. Check http://localhost:8288/functions to see registered functions');
  console.log('4. Look for any errors in the Netlify dev console');
  console.log('\n💡 If functions are not triggering:');
  console.log('   - Make sure npm start is running (not just netlify dev)');
  console.log('   - Check that functions appear at http://localhost:8288/functions');
  console.log('   - Verify the event names match the function triggers\n');
}

// Check if Inngest dev server is running first
fetch('http://localhost:8288')
  .then(() => {
    console.log('✅ Inngest Dev Server is running\n');
    sendTestEvents();
  })
  .catch(() => {
    console.log('❌ Inngest Dev Server is not running!');
    console.log('Please run: ./scripts/start-inngest-local.sh');
  });