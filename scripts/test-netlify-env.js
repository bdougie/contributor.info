#!/usr/bin/env node

// Test if Netlify function can access environment variables
import fetch from 'node-fetch';

const NETLIFY_FUNCTION_URL = 'http://localhost:8888/.netlify/functions';

async function testEnvironment() {
  console.log('🧪 Testing Netlify Function Environment\n');

  try {
    // First test the inngest endpoint
    const inngestResponse = await fetch(`${NETLIFY_FUNCTION_URL}/inngest`);
    const inngestData = await inngestResponse.json();
    
    console.log('✅ Inngest endpoint response:');
    console.log(JSON.stringify(inngestData, null, 2));
    
    // Check if the GitHub webhook endpoint is available
    const webhookResponse = await fetch(`${NETLIFY_FUNCTION_URL}/github-webhook`);
    const webhookText = await webhookResponse.text();
    
    console.log('\n📌 GitHub webhook endpoint status:', webhookResponse.status);
    if (webhookResponse.ok) {
      console.log('   Response:', webhookText.substring(0, 100) + '...');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEnvironment().catch(console.error);