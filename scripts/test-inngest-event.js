#!/usr/bin/env node

/**
 * Test script to send events to Inngest dev server
 * Run with: node scripts/test-inngest-event.js
 */

const INNGEST_DEV_URL = 'http://localhost:8288';

async function sendTestEvent() {
  
  console.log('📤 Sending test event to Inngest dev server...\n');
  
  try {
    // Send event to Inngest dev server's event endpoint
    const response = await fetch(`${INNGEST_DEV_URL}/e/local-dev-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'test/local.hello',
        data: {
          message: 'Test event from script',
          timestamp: new Date().toISOString()
        },
        ts: Date.now()
      })
    });

    if (response.ok) {
      const result = await response.text();
      console.log('✅ Event sent successfully!');
      console.log('Response:', result);
      console.log('\n👀 Check the Inngest dashboard at:');
      console.log('   http://localhost:8288/runs');
      console.log('\nYou should see a new run for "local-test-function"');
    } else {
      console.error('❌ Failed to send event');
      console.error('Status:', response.status);
      console.error('Response:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error sending event:', error.message);
    console.error('\nMake sure:');
    console.error('1. Inngest dev server is running (npm start)');
    console.error('2. The server is accessible at http://localhost:8288');
  }
}

// Also test a repository sync event
async function sendRepositorySyncEvent() {
  console.log('\n📤 Sending repository sync test event...\n');
  
  try {
    const response = await fetch(`${INNGEST_DEV_URL}/e/local-dev-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'capture/repository.sync.graphql',
        data: {
          repositoryId: 'test-repo-id',
          repositoryName: 'test/repo',
          days: 7,
          priority: 'high',
          reason: 'manual-test'
        },
        ts: Date.now()
      })
    });

    if (response.ok) {
      console.log('✅ Repository sync event sent!');
      console.log('This would normally trigger data fetching for a repository');
    } else {
      console.error('❌ Failed to send repository sync event');
      console.error('Status:', response.status);
    }
  } catch (error) {
    console.error('❌ Error sending repository sync event:', error.message);
  }
}

// Run both tests
async function main() {
  console.log('🧪 Testing Inngest Event System\n');
  console.log('=' .repeat(50));
  
  await sendTestEvent();
  await sendRepositorySyncEvent();
  
  console.log('\n' + '=' .repeat(50));
  console.log('\n✨ Test complete! Check http://localhost:8288/runs');
}

main();