import dotenv from 'dotenv';
import { Inngest } from 'inngest';
import fetch from 'node-fetch';

dotenv.config();

console.log('🔍 Inngest Local Development Debugging\n');

async function debugLocalInngest() {
  console.log('1️⃣  Local Environment Check:\n');
  
  // Check local environment variables
  const localEnvVars = {
    'INNGEST_EVENT_KEY': process.env.INNGEST_EVENT_KEY,
    'INNGEST_SIGNING_KEY': process.env.INNGEST_SIGNING_KEY,
    'VITE_INNGEST_APP_ID': process.env.VITE_INNGEST_APP_ID,
    'NODE_ENV': process.env.NODE_ENV,
    'GITHUB_TOKEN': !!process.env.GITHUB_TOKEN || !!process.env.VITE_GITHUB_TOKEN,
    'SUPABASE_URL': !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL
  };

  for (const [key, value] of Object.entries(localEnvVars)) {
    if (key.includes('KEY') && typeof value === 'string') {
      console.log(`${key}: ${value ? '✅ SET' : '❌ NOT SET'}`);
    } else {
      console.log(`${key}: ${value || 'NOT SET'}`);
    }
  }

  console.log('\n2️⃣  Check Inngest Dev Server:\n');
  
  // Check if Inngest dev server is running
  try {
    const devServerResponse = await fetch('http://localhost:8288');
    if (devServerResponse.ok) {
      console.log('✅ Inngest Dev Server is running at http://localhost:8288');
    } else {
      console.log('⚠️  Inngest Dev Server responded with status:', devServerResponse.status);
    }
  } catch (error) {
    console.log('❌ Inngest Dev Server is NOT running');
    console.log('   Run: npx inngest-cli@latest dev -u http://localhost:8888/.netlify/functions/inngest-local');
    return;
  }

  console.log('\n3️⃣  Check Netlify Dev Server:\n');
  
  // Check if Netlify dev is running
  try {
    const netlifyResponse = await fetch('http://localhost:8888');
    if (netlifyResponse.ok) {
      console.log('✅ Netlify Dev Server is running at http://localhost:8888');
    } else {
      console.log('⚠️  Netlify Dev Server responded with status:', netlifyResponse.status);
    }
  } catch (error) {
    console.log('❌ Netlify Dev Server is NOT running');
    console.log('   Run: netlify dev --port 8888');
    return;
  }

  console.log('\n4️⃣  Check Local Inngest Endpoint:\n');
  
  // Check the local Inngest function endpoint
  try {
    const endpointResponse = await fetch('http://localhost:8888/.netlify/functions/inngest-local');
    const endpointData = await endpointResponse.json();
    
    console.log('Endpoint Status:', endpointResponse.status);
    console.log('Response:', JSON.stringify(endpointData, null, 2));
    
    if (endpointData.function_count) {
      console.log(`\n✅ ${endpointData.function_count} functions registered`);
    } else {
      console.log('\n⚠️  No function count in response - functions may not be registered');
    }
  } catch (error) {
    console.log('❌ Failed to reach local Inngest endpoint:', error.message);
  }

  console.log('\n5️⃣  Test Local Event Sending:\n');
  
  // Create a local Inngest client
  const localClient = new Inngest({
    id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
    isDev: true,
    eventKey: process.env.INNGEST_EVENT_KEY || 'test-key'
  });

  try {
    const result = await localClient.send({
      name: 'test/local.hello',
      data: {
        message: 'Testing local Inngest',
        timestamp: new Date().toISOString()
      }
    });
    console.log('✅ Event sent successfully!');
    console.log('Event ID:', result.ids?.[0]);
    console.log('\nCheck the Inngest Dev UI at: http://localhost:8288/stream');
  } catch (error) {
    console.log('❌ Failed to send event:', error.message);
  }

  console.log('\n6️⃣  Check Function Registration:\n');
  
  // Try to fetch registered functions from dev server
  try {
    const functionsResponse = await fetch('http://localhost:8288/functions');
    if (functionsResponse.ok) {
      console.log('✅ Can access functions list at http://localhost:8288/functions');
      console.log('   Check if your functions are listed there');
    }
  } catch (error) {
    console.log('⚠️  Cannot fetch functions list');
  }

  console.log('\n7️⃣  Common Local Development Issues:\n');
  
  console.log('❓ Functions not appearing in Inngest Dev UI?');
  console.log('   → Make sure inngest-local.mts is exporting functions correctly');
  console.log('   → Check that the serve() handler includes all functions');
  console.log('   → Restart both Netlify dev and Inngest dev servers');
  
  console.log('\n❓ Events not triggering functions?');
  console.log('   → Verify event names match between send() and function triggers');
  console.log('   → Check function IDs are unique');
  console.log('   → Look for errors in Netlify dev server console');
  
  console.log('\n❓ "SDK response was not signed" error?');
  console.log('   → This is normal in dev mode - can be ignored');
  console.log('   → Make sure isDev: true in local client');

  console.log('\n📋 Quick Start Commands:\n');
  console.log('Terminal 1: netlify dev --port 8888');
  console.log('Terminal 2: npx inngest-cli@latest dev -u http://localhost:8888/.netlify/functions/inngest-local');
  console.log('\nThen visit: http://localhost:8288');
}

debugLocalInngest().catch(console.error);