#!/usr/bin/env node

/**
 * Script to test sending events to Inngest local development
 * Run with: node scripts/test-inngest-events.js
 */

const events = [
  {
    name: 'test/local.hello',
    data: { message: 'Hello from test script!' },
    description: 'Local test function',
  },
  {
    name: 'test/hello',
    data: { message: 'Factory test!' },
    description: 'Factory test function',
  },
  {
    name: 'capture/repository.sync.graphql',
    data: {
      repositoryId: 'test-repo-123',
      days: 7,
      priority: 'high',
      reason: 'test',
    },
    description: 'Repository sync (GraphQL)',
  },
  {
    name: 'capture/pr.details',
    data: {
      pull_request_id: 'pr-123',
      repository_id: 'repo-456',
    },
    description: 'PR details capture',
  },
];

async function sendEvent(event, port = 8288) {
  const url = `http://localhost:${port}/e/${event.name}`;

  console.log(`\n📤 Sending event: ${event.description}`);
  console.log(`   Event: ${event.name}`);
  console.log(`   Data:`, JSON.stringify(event.data, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: event.data }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`   ✅ Event sent successfully!`);
      console.log(`   Response:`, result);
      return true;
    } else {
      console.log(`   ❌ Failed to send event: ${response.status} ${response.statusText}`);
      const text = await response.text();
      if (text) console.log(`   Error:`, text);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error sending event:`, error.message);
    return false;
  }
}

async function checkInngestStatus() {
  try {
    const response = await fetch('http://localhost:8288/');
    if (response.ok) {
      console.log('✅ Inngest Dev Server is running at http://localhost:8288');
      return true;
    }
  } catch (error) {
    console.error('❌ Inngest Dev Server is not accessible!');
    console.log('   Make sure to run: npm start');
    console.log('   Then wait for all services to initialize');
    return false;
  }
}

async function main() {
  console.log('====================================');
  console.log('  Inngest Event Testing');
  console.log('====================================');

  // Check if Inngest is running
  const inngestRunning = await checkInngestStatus();
  if (!inngestRunning) {
    process.exit(1);
  }

  console.log('\n🚀 Sending test events...');

  // Send test events
  let successCount = 0;
  for (const event of events) {
    const success = await sendEvent(event);
    if (success) successCount++;
    await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay between events
  }

  console.log('\n====================================');
  console.log('  Results');
  console.log('====================================');
  console.log(`✅ Successfully sent: ${successCount}/${events.length} events`);
  console.log('\n📊 Check event processing:');
  console.log('   1. Event Stream: http://localhost:8288/stream');
  console.log('   2. Function Runs: http://localhost:8288/runs');
  console.log('   3. Functions List: http://localhost:8288/functions');

  if (successCount < events.length) {
    console.log('\n⚠️  Some events failed to send.');
    console.log('   This might mean:');
    console.log('   - Functions are not properly registered');
    console.log('   - Inngest Dev Server needs restart');
    console.log('   - Environment variables are missing');
  }
}

main().catch(console.error);
