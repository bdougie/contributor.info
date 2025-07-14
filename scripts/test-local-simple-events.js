import dotenv from 'dotenv';
import { Inngest } from 'inngest';

dotenv.config();

// Create local Inngest client
const inngest = new Inngest({
  id: 'contributor-info',
  isDev: true,
  eventKey: process.env.INNGEST_EVENT_KEY || 'local-dev-key'
});

async function sendLocalTestEvents() {
  console.log('🧪 Sending Local Test Events (for inngest-local function)\n');

  // These events match the simple local function
  const events = [
    {
      name: 'test/local.hello',
      data: {
        message: 'Testing basic local function',
        timestamp: new Date().toISOString()
      }
    },
    {
      name: 'local/capture.pr.details',
      data: {
        repositoryId: 'test-repo-123',
        prNumber: '42'
      }
    },
    {
      name: 'local/sync.repository',
      data: {
        repositoryId: 'test-repo-123',
        days: 7
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

  console.log('📊 These events work with the basic inngest-local function.');
  console.log('For production events, update package.json to use inngest-local-full\n');
}

sendLocalTestEvents();