#!/usr/bin/env node

/**
 * Test script to verify Inngest local setup is working correctly
 * Run with: node scripts/test-inngest-local-setup.js
 */

async function checkInngestEndpoint() {
  console.log('🔍 Checking Inngest local setup...\n');

  try {
    // Check if the endpoint is responding
    const response = await fetch('http://localhost:8888/.netlify/functions/inngest-local-full');

    // Check response status before parsing
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('✅ Inngest endpoint is responding!\n');
    console.log('📊 Status:', data.status);
    console.log('🔢 Function Count:', data.functionCount);
    console.log('🌐 Endpoint:', data.endpoint);
    console.log('\n📝 Registered Functions:');

    if (data.functions && data.functions.length > 0) {
      data.functions.forEach((fn, index) => {
        console.log('   %s. %s → %s', index + 1, fn.id, fn.event);
      });
    } else {
      console.log('   No functions registered yet.');
    }

    console.log('\n🎯 Next Steps:');
    console.log('1. Open Inngest Dashboard: http://localhost:8288');
    console.log('2. Check functions tab: http://localhost:8288/functions');
    console.log('3. View event stream: http://localhost:8288/stream');

    console.log('\n📤 Test Event Commands:');
    console.log('Test function:');
    console.log(`   curl -X POST http://localhost:8288/e/test/local.hello \\\
     -H "Content-Type: application/json" \\
     -d '{"data": {"message": "Test from script!"}}'`);

    console.log('\nRepository sync test:');
    console.log(`   curl -X POST http://localhost:8288/e/capture/repository.sync.graphql \\\
     -H "Content-Type: application/json" \\
     -d '{"data": {"repositoryId": "test-repo-id", "days": 7}}'`);

    return true;
  } catch (error) {
    console.error('❌ Failed to connect to Inngest endpoint!');
    console.error('   Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure npm start is running');
    console.log('2. Wait for all services to initialize (Vite, Netlify, Inngest)');
    console.log('3. Check that port 8888 is available');
    console.log('4. Look for errors in the npm start output');

    process.exit(1);
  }
}

async function checkInngestDashboard() {
  console.log('\n🖥️  Checking Inngest Dashboard...');

  try {
    const response = await fetch('http://localhost:8288/');
    if (response.ok) {
      console.log('✅ Inngest Dashboard is accessible at http://localhost:8288');

      // Check functions endpoint
      const functionsResponse = await fetch('http://localhost:8288/functions');
      if (functionsResponse.ok) {
        console.log('✅ Functions page is accessible');
      }
    }
  } catch (error) {
    console.log('⚠️  Inngest Dashboard may not be running');
    console.log('   Make sure Inngest Dev Server started properly in npm start');
  }
}

// Run the checks
async function main() {
  console.log('====================================');
  console.log('  Inngest Local Setup Test');
  console.log('====================================\n');

  const endpointOk = await checkInngestEndpoint();

  if (endpointOk) {
    await checkInngestDashboard();
  }

  console.log('\n====================================');
  console.log('  Test Complete');
  console.log('====================================');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
