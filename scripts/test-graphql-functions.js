#!/usr/bin/env node

// Test script specifically for GraphQL functions
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const INNGEST_EVENT_URL = 'http://localhost:8288/e/local-dev-key';

// vitejs/vite repository ID from our database
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
      console.log(`   Status: ${result.status || response.status}`);
    } else {
      console.error(`❌ Failed to send event ${eventName}:`, result);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error sending event ${eventName}:`, error.message);
  }
}

async function main() {
  console.log('🧪 Testing GraphQL Functions\n');

  // Test 1: GraphQL Repository Sync
  console.log('1️⃣  Testing capture/repository.sync.graphql');
  await sendEvent('capture/repository.sync.graphql', {
    repositoryId: VITE_REPO_ID,
    days: 1, // Just last day to be quick
    priority: 'high',
    reason: 'graphql-test'
  });

  console.log('\nWaiting 5 seconds for sync to process...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test 2: GraphQL PR Details (for a known PR)
  console.log('2️⃣  Testing capture/pr.details.graphql');
  await sendEvent('capture/pr.details.graphql', {
    repositoryId: VITE_REPO_ID,
    prNumber: '20775', // Recent Vite PR
    priority: 'high'
  });

  console.log('\n📊 Check Results:');
  console.log('1. Visit http://localhost:8288/runs to see function executions');
  console.log('2. Look for "capture-repository-sync-graphql" and "capture-pr-details-graphql" runs');
  console.log('3. Check if they completed successfully or have errors');
  console.log('\n💡 If functions are not running:');
  console.log('   - Check http://localhost:8288/functions to see if GraphQL functions are registered');
  console.log('   - Look for module initialization errors in the console');
  console.log('   - Try restarting npm start');
}

main().catch(console.error);