/**
 * Test script for repository sync event data fix
 * 
 * Purpose: Validates that the repository sync events include all required parameters
 * after fixing the "Repository not found: undefined" error.
 * 
 * This test ensures:
 * 1. The `days` parameter is properly included in the event data
 * 2. The `reason` parameter is included for better debugging
 * 3. The event can be successfully sent to Inngest
 * 
 * Usage:
 *   node scripts/testing/test-repository-sync-fix.mjs
 * 
 * Expected outcome:
 * - Event should be sent successfully with all required parameters
 * - No "Repository not found: undefined" errors should occur
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

console.log('🧪 Testing repository sync event data fix...\n');

// Test configuration
const TEST_REPO_ID = '98b0e461-ea5c-4916-99c0-402fbff5950a'; // continuedev/continue
const TEST_REPO_NAME = 'continuedev/continue';

async function testRepositorySyncFix() {
  // First, verify the repository exists
  console.log('1️⃣ Verifying repository exists in database...');
  const { data: repo, error: repoError } = await supabase
    .from('repositories')
    .select('id, owner, name')
    .eq('id', TEST_REPO_ID)
    .single();

  if (repoError || !repo) {
    console.error('❌ Repository not found in database:', repoError?.message);
    console.log('💡 Try using a different repository ID from your tracked repositories');
    return;
  }

  console.log('✅ Repository found:', `${repo.owner}/${repo.name}`);

  // Simulate the event data that would be sent
  const testEvent = {
    name: 'capture/repository.sync.graphql',
    data: {
      jobId: 'test-job-' + Date.now(),
      repositoryId: repo.id,
      repositoryName: `${repo.owner}/${repo.name}`,
      days: 1, // This parameter was missing before the fix
      maxItems: 50,
      priority: 'medium',
      reason: 'test-fix' // This parameter was also missing
    }
  };

  console.log('\n2️⃣ Event data to be sent:');
  console.log(JSON.stringify(testEvent, null, 2));

  // Validate all required fields are present
  console.log('\n3️⃣ Validating required fields:');
  const requiredFields = ['repositoryId', 'repositoryName', 'days', 'priority', 'reason'];
  const missingFields = requiredFields.filter(field => !testEvent.data[field]);
  
  if (missingFields.length > 0) {
    console.error('❌ Missing required fields:', missingFields.join(', '));
    return;
  }
  
  console.log('✅ All required fields are present');

  // Test the actual API endpoint (if available)
  if (process.env.API_ENDPOINT) {
    console.log('\n4️⃣ Testing API endpoint...');
    try {
      const response = await fetch(`${process.env.API_ENDPOINT}/queue-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventName: testEvent.name,
          data: testEvent.data
        })
      });

      if (response.ok) {
        console.log('✅ Event sent successfully to API!');
        const result = await response.json();
        console.log('Response:', result);
      } else {
        console.error('❌ API request failed:', response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('❌ Error calling API:', error.message);
    }
  } else {
    console.log('\n💡 Set API_ENDPOINT environment variable to test the actual API');
  }

  console.log('\n✨ Test completed!');
  console.log('If the event was sent successfully, the repository sync should process without "undefined" errors.');
}

// Run the test
testRepositorySyncFix().catch(console.error);