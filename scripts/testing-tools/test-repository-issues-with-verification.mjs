#!/usr/bin/env node

/**
 * Test script to trigger capture/repository.issues event and verify database updates
 *
 * Usage:
 *   node scripts/testing-tools/test-repository-issues-with-verification.mjs <repository-id>
 *
 * Example:
 *   node scripts/testing-tools/test-repository-issues-with-verification.mjs "550e8400-e29b-41d4-a716-446655440000"
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const INNGEST_EVENT_KEY =
  process.env.INNGEST_PRODUCTION_EVENT_KEY ||
  process.env.INNGEST_EVENT_KEY ||
  process.env.VITE_INNGEST_EVENT_KEY;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!INNGEST_EVENT_KEY) {
  console.error('❌ Error: INNGEST_EVENT_KEY not found in environment');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in environment');
  process.exit(1);
}

const repositoryId = process.argv[2];

if (!repositoryId) {
  console.error('❌ Error: Repository ID is required');
  console.error(
    'Usage: node scripts/testing-tools/test-repository-issues-with-verification.mjs <repository-id>'
  );
  console.error(
    'Example: node scripts/testing-tools/test-repository-issues-with-verification.mjs "550e8400-e29b-41d4-a716-446655440000"'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get baseline state before triggering event
console.log('📊 Checking database state BEFORE event...\n');

const { data: beforeRepo } = await supabase
  .from('repositories')
  .select('owner, name')
  .eq('id', repositoryId)
  .maybeSingle();

if (!beforeRepo) {
  console.error('❌ Repository not found:', repositoryId);
  process.exit(1);
}

console.log(`Repository: ${beforeRepo.owner}/${beforeRepo.name}`);

const { data: beforeIssues, count: beforeCount } = await supabase
  .from('issues')
  .select('*', { count: 'exact', head: false })
  .eq('repository_id', repositoryId)
  .order('last_synced_at', { ascending: false })
  .limit(5);

console.log(`Total issues: ${beforeCount}`);
if (beforeIssues && beforeIssues.length > 0) {
  console.log('Most recently synced issues:');
  beforeIssues.forEach((issue) => {
    console.log(`  #${issue.number}: ${issue.title}`);
    console.log(`    Last synced: ${issue.last_synced_at}`);
  });
} else {
  console.log('No issues found');
}

// Trigger the event
console.log('\n🚀 Triggering capture/repository.issues event...\n');

const eventData = {
  name: 'capture/repository.issues',
  data: {
    repositoryId: repositoryId,
    timeRange: 30,
    priority: 'high',
    jobId: `test-${Date.now()}`,
  },
};

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
} catch (error) {
  console.error('\n❌ Error sending event:', error.message);
  process.exit(1);
}

// Wait for job to complete (polling with timeout)
console.log('\n⏳ Waiting for job to complete (checking every 5 seconds)...\n');

let maxWaitTime = 60; // seconds
let elapsedTime = 0;
const pollInterval = 5; // seconds

while (elapsedTime < maxWaitTime) {
  await new Promise((resolve) => setTimeout(resolve, pollInterval * 1000));
  elapsedTime += pollInterval;

  const { data: afterIssues, count: afterCount } = await supabase
    .from('issues')
    .select('last_synced_at', { count: 'exact', head: false })
    .eq('repository_id', repositoryId)
    .gt('last_synced_at', new Date(Date.now() - 60000).toISOString()) // Issues synced in last 60 seconds
    .limit(1);

  console.log(`[${elapsedTime}s] Checking for updated issues...`);

  if (afterCount > 0) {
    console.log('\n✅ Database updated successfully!');
    console.log(`Found ${afterCount} issues synced in the last 60 seconds`);

    // Get full details
    const { data: finalIssues } = await supabase
      .from('issues')
      .select('number, title, last_synced_at')
      .eq('repository_id', repositoryId)
      .order('last_synced_at', { ascending: false })
      .limit(5);

    console.log('\nMost recently synced issues:');
    finalIssues.forEach((issue) => {
      console.log(`  #${issue.number}: ${issue.title}`);
      console.log(`    Last synced: ${issue.last_synced_at}`);
    });

    process.exit(0);
  }
}

console.log(`\n⚠️  Timeout: No database updates detected after ${maxWaitTime} seconds`);
console.log('This suggests the Inngest job may have failed or the database is not being updated.');
console.log('\n📊 Check Inngest dashboard for job execution:');
console.log('   https://app.inngest.com/');
process.exit(1);
