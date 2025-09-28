import dotenv from 'dotenv';
import { Inngest } from 'inngest';

dotenv.config();

// Create production Inngest client
const inngest = new Inngest({
  id: 'contributor-info',
  isDev: false, // Production mode
  eventKey: process.env.INNGEST_PRODUCTION_EVENT_KEY || process.env.INNGEST_EVENT_KEY,
});

async function testProductionInngest() {
  console.log('🚀 Testing Production Inngest\n');

  const events = [
    {
      name: 'test/prod.hello',
      data: {
        message: 'Testing production Inngest',
        timestamp: new Date().toISOString(),
      },
    },
    {
      name: 'capture/repository.sync.graphql',
      data: {
        repositoryId: 'f4b8c464-e506-5612-9ca8-0c96e7d8bbf0', // contributor.info
        days: 7,
        priority: 'medium',
        reason: 'production-test',
      },
    },
    {
      name: 'classify/repository.single',
      data: {
        repositoryId: 'f4b8c464-e506-5612-9ca8-0c96e7d8bbf0',
        owner: 'bdougie',
        repo: 'contributor.info',
      },
    },
  ];

  console.log('Sending events to production Inngest...\n');

  for (const event of events) {
    try {
      console.log(`📤 Sending: ${event.name}`);
      const result = await inngest.send(event);
      console.log(`✅ Success - Event ID: ${result.ids?.[0]}\n`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}\n`);
    }
  }

  console.log('📊 Check your production Inngest dashboard:');
  console.log('https://app.inngest.com/env/production/events');
  console.log('https://app.inngest.com/env/production/runs');
}

testProductionInngest();
