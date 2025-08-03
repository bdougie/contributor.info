#!/usr/bin/env node

// Test update PR activity function
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
  console.log('🧪 Testing Update PR Activity Function\n');

  // Trigger update PR activity for vitejs/vite
  console.log('1️⃣  Testing update/pr.activity');
  await sendEvent('update/pr.activity', {
    repositoryId: VITE_REPO_ID,
    daysToCheck: 7,
    priority: 'high'
  });

  console.log('\n📊 This function will:');
  console.log('1. Find PRs that need comment/review updates');
  console.log('2. Queue capture jobs for those PRs');
  console.log('3. Update the data to include comments and reviews');
  console.log('\n✨ Check the database in a few moments to see if comments/reviews are captured');
}

main().catch(console.error);