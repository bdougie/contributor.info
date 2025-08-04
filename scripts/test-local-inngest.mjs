#!/usr/bin/env node

console.log('Testing local Inngest endpoint...\n');

// Test 1: Check if the endpoint is accessible
console.log('1. Testing GET request to /api/inngest...');
try {
  const response = await fetch('http://localhost:8888/api/inngest');
  console.log(`   Status: ${response.status}`);
  
  if (response.ok) {
    const data = await response.json();
    console.log('   ✅ Endpoint is accessible');
    console.log(`   Message: ${data.message}`);
    console.log(`   Environment: ${JSON.stringify(data.environment)}`);
    console.log(`   Functions: ${data.functions?.length || 0} functions registered`);
    if (data.functions?.length > 0) {
      console.log('   Available functions:');
      data.functions.forEach(fn => {
        console.log(`     - ${fn.id || fn}`);
      });
    }
  } else {
    console.log('   ❌ Endpoint returned error:', response.statusText);
    const text = await response.text();
    console.log('   Response:', text);
  }
} catch (error) {
  console.log('   ❌ Failed to connect:', error.message);
  console.log('   Make sure netlify dev is running on port 8888');
}

console.log('\n2. Testing health check endpoint...');
try {
  const response = await fetch('http://localhost:8888/api/health');
  console.log(`   Status: ${response.status}`);
  
  if (response.ok) {
    const data = await response.json();
    console.log('   ✅ Health check accessible');
    console.log(`   Overall status: ${data.status}`);
    if (data.services) {
      console.log('   Service statuses:');
      data.services.forEach(service => {
        const icon = service.status === 'healthy' ? '✅' : service.status === 'degraded' ? '⚠️' : '❌';
        console.log(`     ${icon} ${service.service}: ${service.status} - ${service.message}`);
      });
    }
  } else {
    console.log('   ❌ Health check failed:', response.statusText);
  }
} catch (error) {
  console.log('   ❌ Failed to connect to health check:', error.message);
}

console.log('\n3. Testing if we can send a test event...');
try {
  const testEvent = {
    name: 'test/hello',
    data: {
      message: 'Test from local script',
      timestamp: new Date().toISOString()
    }
  };
  
  console.log('   Sending test event:', JSON.stringify(testEvent, null, 2));
  
  const response = await fetch('http://localhost:8888/api/inngest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(testEvent)
  });
  
  console.log(`   Status: ${response.status}`);
  
  if (response.ok || response.status === 200 || response.status === 206) {
    console.log('   ✅ Event accepted by Inngest');
    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        console.log('   Response:', JSON.stringify(data, null, 2));
      } catch {
        console.log('   Response:', text);
      }
    }
  } else {
    console.log('   ⚠️  Event may have been rejected (this is normal without proper signing in dev)');
    console.log('   Response status:', response.status, response.statusText);
  }
} catch (error) {
  console.log('   ❌ Failed to send event:', error.message);
}

console.log('\n✅ Test completed! Check the output above to see if Inngest is working correctly.');
console.log('If the GET request shows functions are registered, the handler is loaded successfully.');