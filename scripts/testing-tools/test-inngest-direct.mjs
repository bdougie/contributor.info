#!/usr/bin/env node

import { config } from 'dotenv';
config();

// Test direct Inngest event sending
async function testInngestEvent() {
  const eventData = {
    eventName: 'capture/pr.comments',
    data: {
      repositoryId: '3f1a7d29-d862-463c-a136-17fa7d5a98c2', // A vitejs/vite PR
      prNumber: '20528',
      prId: '3f1a7d29-d862-463c-a136-17fa7d5a98c2',
      prGithubId: '20528',
      priority: 'high',
    }
  };

  console.log('🚀 Sending test event to Inngest...\n');
  console.log('Event data:', JSON.stringify(eventData, null, 2));

  try {
    const response = await fetch('http://localhost:8888/api/queue-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    const result = await response.text();
    console.log('\nResponse status:', response.status);
    console.log('Response:', result);

    if (response.ok) {
      console.log('\n✅ Event sent successfully!');
      console.log('Check the Inngest dashboard at http://localhost:8288 for function execution');
    } else {
      console.log('\n❌ Failed to send event');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure the dev server is running (npm start)');
  }
}

testInngestEvent();