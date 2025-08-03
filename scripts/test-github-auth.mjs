#!/usr/bin/env node

import { config } from 'dotenv';

// Load environment variables
config();

// Check GitHub token configuration
console.log('🔐 GitHub Token Configuration Check:\n');

const clientToken = process.env.VITE_GITHUB_TOKEN;
const serverToken = process.env.GITHUB_TOKEN;

console.log('Client token (VITE_GITHUB_TOKEN):', clientToken ? `✅ Set (${clientToken.substring(0, 10)}...)` : '❌ Not set');
console.log('Server token (GITHUB_TOKEN):', serverToken ? `✅ Set (${serverToken.substring(0, 10)}...)` : '❌ Not set');

// Test GitHub API with the token
async function testGitHubAPI() {
  const token = serverToken || clientToken;
  
  if (!token) {
    console.log('\n❌ No GitHub token available for testing');
    return;
  }

  console.log('\n🧪 Testing GitHub API with token...\n');

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.ok) {
      const user = await response.json();
      console.log('✅ GitHub API authentication successful!');
      console.log(`   Authenticated as: ${user.login}`);
      console.log(`   Rate limit remaining: ${response.headers.get('x-ratelimit-remaining')}`);
    } else {
      console.log('❌ GitHub API authentication failed:', response.status, response.statusText);
      const error = await response.text();
      console.log('   Error:', error);
    }

    // Test fetching a PR with comments
    console.log('\n🔍 Testing PR data fetch...\n');
    const prResponse = await fetch('https://api.github.com/repos/continuedev/continue/pulls/6935', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (prResponse.ok) {
      const pr = await prResponse.json();
      console.log('✅ PR fetch successful!');
      console.log(`   PR #${pr.number}: ${pr.title}`);
      console.log(`   Comments: ${pr.comments}`);
      console.log(`   Review comments: ${pr.review_comments}`);
    } else {
      console.log('❌ PR fetch failed:', prResponse.status, prResponse.statusText);
    }

  } catch (error) {
    console.error('❌ Error testing GitHub API:', error);
  }
}

// Check Inngest configuration
console.log('\n🔧 Inngest Configuration:\n');
console.log('Event Key:', process.env.INNGEST_EVENT_KEY ? '✅ Set' : '❌ Not set');
console.log('Signing Key:', process.env.INNGEST_SIGNING_KEY ? '✅ Set' : '❌ Not set');
console.log('Production Event Key:', process.env.INNGEST_PRODUCTION_EVENT_KEY ? '✅ Set' : '❌ Not set');
console.log('Production Signing Key:', process.env.INNGEST_PRODUCTION_SIGNING_KEY ? '✅ Set' : '❌ Not set');

// Run the test
testGitHubAPI();