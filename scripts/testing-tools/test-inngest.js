#!/usr/bin/env node

import { Inngest } from 'inngest';

// Test Inngest connection with explicit local configuration
const inngest = new Inngest({
  id: 'contributor-info',
  isDev: true,
  eventKey:
    process.env.INNGEST_EVENT_KEY || 'test_gMxyJRNyQOy2UYpMidaLhrADUYZYELRdq4zL5xgU3KGVfyLb',
});

async function testInngest() {
  console.log('Testing Inngest connection...');
  console.log('Event Key:', process.env.INNGEST_EVENT_KEY ? 'Found' : 'Missing');
  console.log('Inngest Dev Server: http://localhost:8288');

  try {
    // Send a test event
    const result = await inngest.send({
      name: 'test/event',
      data: {
        message: 'Test event from script',
        timestamp: new Date().toISOString(),
      },
    });

    console.log('✅ Event sent successfully!');
    console.log('Event ID:', result.ids?.[0]);
    console.log('\nCheck http://localhost:8288/stream to see the event');
  } catch (error) {
    console.error('❌ Failed to send event:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Inngest Dev Server is running: npx inngest-cli dev');
    console.error('2. Check that the event key matches your Inngest configuration');
    console.error(
      '3. Ensure the Inngest endpoint is accessible at http://127.0.0.1:8888/.netlify/functions/inngest'
    );
  }
}

testInngest();
