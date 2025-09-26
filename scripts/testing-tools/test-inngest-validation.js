// Test script to verify Inngest validation for undefined repositoryId
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testInngestValidation() {
  console.log('Testing Inngest validation for undefined repositoryId...\n');

  // Test 1: Send event with undefined repositoryId
  console.log('Test 1: Sending event with undefined repositoryId');
  try {
    const response1 = await fetch('http://localhost:8288/e/key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'capture/repository.sync.graphql',
        data: {
          // repositoryId is missing/undefined
          days: 7,
          priority: 'high',
          reason: 'test',
        },
      }),
    });

    const result1 = await response1.text();
    console.log('Response:', response1.status, result1);
  } catch (error) {
    console.error('Error sending event:', error);
  }

  // Test 2: Send event with null repositoryId
  console.log('\nTest 2: Sending event with null repositoryId');
  try {
    const response2 = await fetch('http://localhost:8288/e/key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'capture/repository.sync.graphql',
        data: {
          repositoryId: null,
          days: 7,
          priority: 'high',
          reason: 'test',
        },
      }),
    });

    const result2 = await response2.text();
    console.log('Response:', response2.status, result2);
  } catch (error) {
    console.error('Error sending event:', error);
  }

  // Test 3: Send valid event with repositoryId
  console.log('\nTest 3: Sending valid event with repositoryId');
  try {
    const response3 = await fetch('http://localhost:8288/e/key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'capture/repository.sync.graphql',
        data: {
          repositoryId: 'test-repo-id-123',
          days: 7,
          priority: 'high',
          reason: 'test',
        },
      }),
    });

    const result3 = await response3.text();
    console.log('Response:', response3.status, result3);
  } catch (error) {
    console.error('Error sending event:', error);
  }

  console.log('\n✅ Validation tests completed');
  console.log('Check the Inngest Dev UI at http://localhost:8288 to see the function runs');
}

testInngestValidation();
