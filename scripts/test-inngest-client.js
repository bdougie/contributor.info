#!/usr/bin/env node

/**
 * Test sending events through the Inngest client directly
 * This bypasses the dev server UI and sends events properly
 */

import { Inngest } from 'inngest';

// Create client matching your local configuration
const inngest = new Inngest({
  id: 'contributor-info',
  isDev: true,
  eventKey: 'local-dev-key',
  // In dev mode, events are sent to the local dev server
  baseUrl: process.env.INNGEST_BASE_URL || 'http://127.0.0.1:8288',
});

async function sendTestEvent() {
  console.log('====================================');
  console.log('  Testing Inngest Event Sending');
  console.log('====================================\n');

  const events = [
    {
      name: 'test/hello',
      data: {
        message: 'Hello from direct client test!',
        timestamp: new Date().toISOString(),
      },
    },
    {
      name: 'capture/repository.sync.graphql',
      data: {
        owner: 'facebook',
        name: 'react',
        repositoryId: 'MDEwOlJlcG9zaXRvcnkxMDI3MDI1MA==',
        days: 7,
        priority: 'high',
        reason: 'test',
      },
    },
  ];

  for (const event of events) {
    console.log(`📤 Sending event: ${event.name}`);
    console.log(`   Data: ${JSON.stringify(event.data, null, 2)}`);

    try {
      // Send event through Inngest client
      const result = await inngest.send(event);
      console.log(`   ✅ Event sent successfully!`);
      console.log(`   Event IDs: ${result.ids.join(', ')}\n`);
    } catch (error) {
      console.error(`   ❌ Failed to send event: ${error.message}\n`);
    }
  }

  console.log('\n📊 Check event processing at:');
  console.log('   Events: http://localhost:8288/events');
  console.log('   Runs: http://localhost:8288/runs');
  console.log('   Functions: http://localhost:8288/functions');
}

sendTestEvent().catch(console.error);
