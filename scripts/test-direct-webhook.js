#!/usr/bin/env node

/**
 * Test the direct webhook approach using repository info from payload
 */

import { handlePROpenedDirect } from '../app/webhooks/pull-request-direct.js';

// Simulate the webhook payload that was received for PR #310
const mockWebhookPayload = {
  action: 'opened',
  number: 310,
  pull_request: {
    id: 2088773948,
    number: 310,
    title: 'feat: add Core Web Vitals monitoring with integrated analytics pipeline',
    body: 'This is a test PR to verify webhook functionality',
    state: 'open',
    user: {
      login: 'bdougie',
      id: 5713670,
      type: 'User'
    },
    html_url: 'https://github.com/bdougie/contributor.info/pull/310',
    created_at: '2025-08-07T01:31:33Z',
    updated_at: '2025-08-07T01:31:33Z',
  },
  repository: {
    id: 967062465,  // Correct GitHub ID from webhook
    node_id: 'R_kgDOOXsaQQ',
    name: 'contributor.info',
    full_name: 'bdougie/contributor.info',
    owner: {
      login: 'bdougie',
      id: 5713670,
      type: 'User'
    },
    private: false,
    description: 'Learn about your contributors!',
    language: 'TypeScript',
    stargazers_count: 12,
    forks_count: 3,
    open_issues_count: 5,
    default_branch: 'main',
    created_at: '2024-01-15T12:30:00Z',
    updated_at: '2025-08-07T00:00:00Z',
  },
  installation: {
    id: 54968432,  // From webhook payload
    account: {
      login: 'bdougie',
      type: 'User'
    }
  }
};

async function testDirectWebhook() {
  console.log('🧪 Testing direct webhook handler\n');
  console.log('Repository info from webhook:');
  console.log(`  - Name: ${mockWebhookPayload.repository.full_name}`);
  console.log(`  - GitHub ID: ${mockWebhookPayload.repository.id}`);
  console.log(`  - Installation: ${mockWebhookPayload.installation.id}`);
  console.log('');
  
  console.log('PR info:');
  console.log(`  - Number: #${mockWebhookPayload.pull_request.number}`);
  console.log(`  - Title: ${mockWebhookPayload.pull_request.title}`);
  console.log(`  - Author: ${mockWebhookPayload.pull_request.user.login}`);
  console.log('');
  
  console.log('Calling handlePROpenedDirect with webhook payload...\n');
  
  try {
    // Test the direct handler
    await handlePROpenedDirect(mockWebhookPayload);
    
    console.log('\n✅ Direct webhook handler executed successfully');
    console.log('\nKey improvements:');
    console.log('  1. Uses repository info directly from webhook payload');
    console.log('  2. No database lookup required for commenting');
    console.log('  3. Automatically fixes wrong GitHub IDs if found');
    console.log('  4. Creates repository entry if not tracked');
    console.log('  5. Posts reviewer suggestions even without similar issues');
    
  } catch (error) {
    console.error('\n❌ Error testing direct webhook:', error);
  }
}

// Run the test
testDirectWebhook().catch(console.error);