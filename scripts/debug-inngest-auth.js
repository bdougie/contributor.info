import dotenv from 'dotenv';
import crypto from 'crypto';
import { Inngest } from 'inngest';

dotenv.config();

console.log('🔍 Inngest Authentication Debugging Tool\n');

// Function to mask sensitive keys
function maskKey(key) {
  if (!key) return 'NOT SET';
  if (key.length < 10) return key;
  return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
}

// Function to generate signing key hash for comparison
function hashKey(key) {
  if (!key) return 'NO_KEY';
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16);
}

async function debugInngestAuth() {
  console.log('1️⃣  Environment Variables Check:\n');
  
  // Check all possible Inngest-related environment variables
  const envVars = {
    'INNGEST_EVENT_KEY': process.env.INNGEST_EVENT_KEY,
    'INNGEST_SIGNING_KEY': process.env.INNGEST_SIGNING_KEY,
    'INNGEST_PRODUCTION_EVENT_KEY': process.env.INNGEST_PRODUCTION_EVENT_KEY,
    'INNGEST_PRODUCTION_SIGNING_KEY': process.env.INNGEST_PRODUCTION_SIGNING_KEY,
    'VITE_INNGEST_APP_ID': process.env.VITE_INNGEST_APP_ID,
    'VITE_INNGEST_EVENT_KEY': process.env.VITE_INNGEST_EVENT_KEY,
    'NODE_ENV': process.env.NODE_ENV,
    'CONTEXT': process.env.CONTEXT,
    'NETLIFY': process.env.NETLIFY
  };

  for (const [key, value] of Object.entries(envVars)) {
    if (key.includes('KEY')) {
      console.log(`${key}: ${maskKey(value)} (hash: ${hashKey(value)})`);
    } else {
      console.log(`${key}: ${value || 'NOT SET'}`);
    }
  }

  console.log('\n2️⃣  Client Configuration Tests:\n');

  // Test different client configurations
  const configs = [
    {
      name: 'Development Client',
      client: new Inngest({
        id: 'contributor-info',
        isDev: true,
        eventKey: process.env.INNGEST_EVENT_KEY
      })
    },
    {
      name: 'Production Client (with prod keys)',
      client: new Inngest({
        id: 'contributor-info',
        isDev: false,
        eventKey: process.env.INNGEST_PRODUCTION_EVENT_KEY || process.env.INNGEST_EVENT_KEY,
        signingKey: process.env.INNGEST_PRODUCTION_SIGNING_KEY || process.env.INNGEST_SIGNING_KEY
      })
    },
    {
      name: 'Production Client (fallback keys)',
      client: new Inngest({
        id: 'contributor-info',
        isDev: false,
        eventKey: process.env.INNGEST_EVENT_KEY,
        signingKey: process.env.INNGEST_SIGNING_KEY
      })
    }
  ];

  for (const config of configs) {
    console.log(`Testing ${config.name}:`);
    try {
      const result = await config.client.send({
        name: 'test/auth.debug',
        data: { 
          test: true, 
          config: config.name,
          timestamp: new Date().toISOString() 
        }
      });
      console.log(`✅ Success - Event ID: ${result.ids?.[0]}`);
    } catch (error) {
      console.log(`❌ Failed - ${error.message}`);
    }
  }

  console.log('\n3️⃣  Endpoint Authentication Tests:\n');

  // Test endpoints with different signing scenarios
  const endpoints = [
    {
      name: 'Local endpoint',
      url: 'http://localhost:8888/.netlify/functions/inngest-local'
    },
    {
      name: 'Production endpoint',
      url: 'https://contributor.info/.netlify/functions/inngest-prod'
    }
  ];

  for (const endpoint of endpoints) {
    console.log(`Testing ${endpoint.name}:`);
    try {
      const response = await fetch(endpoint.url);
      const data = await response.json();
      console.log(`  Status: ${response.status}`);
      console.log(`  Auth Success: ${data.authentication_succeeded}`);
      console.log(`  Has Event Key: ${data.has_event_key}`);
      console.log(`  Has Signing Key: ${data.has_signing_key}`);
      console.log(`  Functions Count: ${data.function_count || 'unknown'}`);
      if (data.error) {
        console.log(`  Error: ${data.error}`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }

  console.log('\n4️⃣  Signing Key Verification:\n');

  // Create a test signature to verify signing key
  const testPayload = JSON.stringify({ test: true, timestamp: Date.now() });
  const signingKeys = [
    { name: 'INNGEST_SIGNING_KEY', key: process.env.INNGEST_SIGNING_KEY },
    { name: 'INNGEST_PRODUCTION_SIGNING_KEY', key: process.env.INNGEST_PRODUCTION_SIGNING_KEY }
  ];

  for (const { name, key } of signingKeys) {
    if (key) {
      const signature = crypto
        .createHmac('sha256', key)
        .update(testPayload)
        .digest('hex');
      console.log(`${name}:`);
      console.log(`  Key Hash: ${hashKey(key)}`);
      console.log(`  Test Signature: ${signature.substring(0, 32)}...`);
    } else {
      console.log(`${name}: NOT SET`);
    }
  }

  console.log('\n5️⃣  Recommendations:\n');
  
  // Provide specific recommendations based on findings
  if (!process.env.INNGEST_PRODUCTION_SIGNING_KEY) {
    console.log('⚠️  INNGEST_PRODUCTION_SIGNING_KEY is not set');
    console.log('   → Add this to your Netlify environment variables');
    console.log('   → Get the key from: https://app.inngest.com/env/production/manage/signing-key');
  }

  if (!process.env.INNGEST_PRODUCTION_EVENT_KEY) {
    console.log('⚠️  INNGEST_PRODUCTION_EVENT_KEY is not set');
    console.log('   → Add this to your Netlify environment variables');
    console.log('   → Get the key from: https://app.inngest.com/env/production/manage/keys');
  }

  console.log('\n📋 Next Steps:');
  console.log('1. Go to https://app.inngest.com');
  console.log('2. Navigate to your production environment');
  console.log('3. Check that your app "contributor-info" exists');
  console.log('4. Verify the endpoint URL is registered correctly');
  console.log('5. Copy the signing key and event key');
  console.log('6. Add them to Netlify as INNGEST_PRODUCTION_SIGNING_KEY and INNGEST_PRODUCTION_EVENT_KEY');
  console.log('7. Redeploy your site');
  
  console.log('\n🔗 Useful Links:');
  console.log('- Inngest Dashboard: https://app.inngest.com/env/production/apps');
  console.log('- Netlify Env Vars: https://app.netlify.com/sites/contributor-info/configuration/env');
  console.log('- Inngest Docs: https://www.inngest.com/docs/deploy/netlify');
}

debugInngestAuth().catch(console.error);