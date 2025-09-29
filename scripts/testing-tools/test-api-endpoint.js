#!/usr/bin/env node

/**
 * Test script to verify the suggest-reviewers API endpoint
 */

async function testEndpoint() {
  const baseUrl = 'http://localhost:5174'; // Your local dev server
  const owner = 'continuedev';
  const repo = 'continue';
  
  console.log('Testing suggest-reviewers endpoint...\n');
  
  try {
    const response = await fetch(`${baseUrl}/api/repos/${owner}/${repo}/suggest-reviewers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: ['src/test.ts', 'src/components/Button.tsx'],
        prAuthor: 'testuser'
      })
    });
    
    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('\nResponse Body:', JSON.stringify(data, null, 2));
    
    if (response.status === 404) {
      console.log('\n❌ Repository not tracked in database');
      console.log('   Please ensure the repository is added to tracked_repositories table');
    } else if (response.status === 500) {
      console.log('\n❌ Server error - likely database connection issue');
      console.log('   Check that Supabase environment variables are set correctly');
    } else if (response.status === 200) {
      console.log('\n✅ API endpoint is working correctly!');
    }
  } catch (error) {
    console.error('\n❌ Failed to connect to endpoint:', error.message);
    console.log('   Make sure you\'re running: npm start (not just npm run dev)');
  }
}

testEndpoint();