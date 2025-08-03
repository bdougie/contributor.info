#!/usr/bin/env node

// Test REST sync functions
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const INNGEST_EVENT_URL = 'http://localhost:8288/e/local-dev-key';
const VITE_REPO_ID = '4789fa82-3db4-4931-a945-f48f7bd67111';

async function sendEvent(eventName, data) {
  try {
    const response = await fetch(INNGEST_EVENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: eventName,
        data: data
      })
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Event sent: ${eventName}`);
      console.log(`   Event ID: ${result.ids?.[0] || 'Unknown'}`);
      return result;
    } else {
      console.error(`❌ Failed to send event ${eventName}:`, result);
    }
  } catch (error) {
    console.error(`❌ Error sending event ${eventName}:`, error.message);
  }
}

async function main() {
  console.log('🧪 Testing REST Sync Functions\n');

  // Test REST Repository Sync (non-GraphQL)
  console.log('1️⃣  Testing capture/repository.sync (REST)');
  await sendEvent('capture/repository.sync', {
    repositoryId: VITE_REPO_ID,
    days: 1,
    priority: 'high',
    reason: 'rest-test'
  });

  console.log('\n2️⃣  Testing simple hello event');
  await sendEvent('test/local.hello', {
    message: 'Testing after restart',
    timestamp: new Date().toISOString()
  });

  console.log('\n📊 Next Steps:');
  console.log('1. Check http://localhost:8288/runs to see if functions executed');
  console.log('2. Look for "capture-repository-sync" (REST) and "local-test-function" runs');
  console.log('3. Check the database for new PRs or sync logs');
}

main().catch(console.error);