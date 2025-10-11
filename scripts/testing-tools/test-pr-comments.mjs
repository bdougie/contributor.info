#!/usr/bin/env node

/**
 * Test script to trigger capture/pr.comments event
 *
 * Usage:
 *   node scripts/testing-tools/test-pr-comments.mjs <repository-id> <pr-number> <pr-id>
 *
 * Example:
 *   node scripts/testing-tools/test-pr-comments.mjs "550e8400-e29b-41d4-a716-446655440000" "123" "PR_kwDOAbc123"
 */

import 'dotenv/config';

const INNGEST_EVENT_KEY =
  process.env.INNGEST_PRODUCTION_EVENT_KEY ||
  process.env.INNGEST_EVENT_KEY ||
  process.env.VITE_INNGEST_EVENT_KEY;

if (!INNGEST_EVENT_KEY) {
  console.error('❌ Error: INNGEST_EVENT_KEY or VITE_INNGEST_EVENT_KEY not found in environment');
  process.exit(1);
}

const repositoryId = process.argv[2];
const prNumber = process.argv[3];
const prId = process.argv[4];

if (!repositoryId || !prNumber || !prId) {
  console.error('❌ Error: All three arguments are required');
  console.error(
    'Usage: node scripts/testing-tools/test-pr-comments.mjs <repository-id> <pr-number> <pr-id>'
  );
  console.error(
    'Example: node scripts/testing-tools/test-pr-comments.mjs "550e8400-e29b-41d4-a716-446655440000" "123" "PR_kwDOAbc123"'
  );
  process.exit(1);
}

console.log('🚀 Testing capture/pr.comments event...\n');
console.log('Repository ID:', repositoryId);
console.log('PR Number:', prNumber);
console.log('PR ID:', prId);
console.log('Inngest Event Key:', INNGEST_EVENT_KEY.substring(0, 10) + '...\n');

const eventData = {
  name: 'capture/pr.comments',
  data: {
    repositoryId: repositoryId,
    prNumber: parseInt(prNumber, 10),
    prId: prId,
    priority: 'high',
    jobId: `test-${Date.now()}`,
  },
};

console.log('📤 Sending event to Inngest...');
console.log('Event data:', JSON.stringify(eventData, null, 2));

try {
  const response = await fetch(`https://inn.gs/e/${INNGEST_EVENT_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('\n❌ Failed to send event:', response.status, response.statusText);
    console.error('Response:', errorText);
    process.exit(1);
  }

  const result = await response.json();
  console.log('\n✅ Event sent successfully!');
  console.log('Response:', JSON.stringify(result, null, 2));
  console.log('\n📊 Check Inngest dashboard for job execution:');
  console.log('   https://app.inngest.com/');
} catch (error) {
  console.error('\n❌ Error sending event:', error.message);
  process.exit(1);
}
