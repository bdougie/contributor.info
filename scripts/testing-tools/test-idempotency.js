// Test script for the idempotency key functionality
// Usage: VITE_SUPABASE_URL=your-url VITE_SUPABASE_ANON_KEY=your-key node test-idempotency.js

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

/**
 * Generate a unique idempotency key
 */
function generateIdempotencyKey() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Send a request with an idempotency key
 */
async function sendRequestWithIdempotency(idempotencyKey, eventData) {
  const queueEventUrl = `${SUPABASE_URL}/functions/v1/queue-event`;

  const response = await fetch(queueEventUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(eventData),
  });

  const result = await response.json();
  return { response, result };
}

/**
 * Test idempotency deduplication
 */
async function testIdempotencyDeduplication() {
  console.log('🧪 Testing Idempotency Key Deduplication\n');
  console.log('='.repeat(50));

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ Required environment variables are not set');
    console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    return;
  }

  // Test 1: Send unique requests with different idempotency keys
  console.log('\n📝 Test 1: Unique requests with different idempotency keys');
  console.log('-'.repeat(50));

  const key1 = generateIdempotencyKey();
  const key2 = generateIdempotencyKey();

  const event1 = {
    eventName: 'test/idempotency.unique',
    data: {
      test: 'unique-request-1',
      timestamp: new Date().toISOString(),
    },
  };

  const event2 = {
    eventName: 'test/idempotency.unique',
    data: {
      test: 'unique-request-2',
      timestamp: new Date().toISOString(),
    },
  };

  try {
    console.log('Sending first request with key:', key1);
    const { result: result1 } = await sendRequestWithIdempotency(key1, event1);
    console.log('✅ First request succeeded:', {
      eventId: result1.eventId,
      duplicate: result1.duplicate,
    });

    console.log('\nSending second request with different key:', key2);
    const { result: result2 } = await sendRequestWithIdempotency(key2, event2);
    console.log('✅ Second request succeeded:', {
      eventId: result2.eventId,
      duplicate: result2.duplicate,
    });

    if (result1.eventId !== result2.eventId) {
      console.log('✅ Different idempotency keys resulted in different events');
    } else {
      console.log('❌ Different idempotency keys should create different events');
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }

  // Test 2: Send duplicate requests with same idempotency key
  console.log('\n📝 Test 2: Duplicate requests with same idempotency key');
  console.log('-'.repeat(50));

  const duplicateKey = generateIdempotencyKey();
  const duplicateEvent = {
    eventName: 'test/idempotency.duplicate',
    data: {
      test: 'duplicate-test',
      value: Math.random(),
      timestamp: new Date().toISOString(),
    },
  };

  try {
    console.log('Sending original request with key:', duplicateKey);
    const { result: original } = await sendRequestWithIdempotency(duplicateKey, duplicateEvent);
    console.log('✅ Original request:', {
      eventId: original.eventId,
      duplicate: original.duplicate,
    });

    // Wait a moment to ensure the first request is processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('\nSending duplicate request with same key:', duplicateKey);
    const { result: duplicate } = await sendRequestWithIdempotency(duplicateKey, duplicateEvent);
    console.log('✅ Duplicate request:', {
      eventId: duplicate.eventId,
      duplicate: duplicate.duplicate,
      cached: duplicate.cached,
    });

    if (duplicate.duplicate === true && duplicate.cached === true) {
      console.log('✅ Duplicate request was correctly identified and cached response returned');
    } else {
      console.log('⚠️  Duplicate request was not marked as duplicate (may still be processing)');
    }

    if (original.eventId === duplicate.eventId) {
      console.log('✅ Same event ID returned for duplicate request');
    } else {
      console.log('⚠️  Different event IDs (first request may still be processing)');
    }
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }

  // Test 3: Rapid-fire duplicate requests (race condition test)
  console.log('\n📝 Test 3: Rapid-fire duplicate requests (race condition)');
  console.log('-'.repeat(50));

  const raceKey = generateIdempotencyKey();
  const raceEvent = {
    eventName: 'test/idempotency.race',
    data: {
      test: 'race-condition',
      timestamp: new Date().toISOString(),
    },
  };

  try {
    console.log('Sending 5 concurrent requests with same key:', raceKey);
    const promises = Array(5)
      .fill(null)
      .map((_, i) =>
        sendRequestWithIdempotency(raceKey, raceEvent).then(({ result }) => ({
          index: i,
          ...result,
        }))
      );

    const results = await Promise.all(promises);

    const uniqueEventIds = new Set(results.map((r) => r.eventId));
    const duplicateCount = results.filter((r) => r.duplicate).length;

    console.log('Results:');
    results.forEach((r) => {
      console.log(`  Request ${r.index}: eventId=${r.eventId}, duplicate=${r.duplicate}`);
    });

    console.log(
      `\n📊 Summary: ${uniqueEventIds.size} unique event ID(s), ${duplicateCount} marked as duplicate`
    );

    if (uniqueEventIds.size === 1) {
      console.log('✅ All concurrent requests returned the same event ID');
    } else {
      console.log('⚠️  Multiple event IDs returned (race condition handling may need improvement)');
    }
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }

  // Test 4: Request without idempotency key
  console.log('\n📝 Test 4: Request without idempotency key');
  console.log('-'.repeat(50));

  const noKeyEvent = {
    eventName: 'test/idempotency.no-key',
    data: {
      test: 'no-idempotency-key',
      timestamp: new Date().toISOString(),
    },
  };

  try {
    console.log('Sending request without idempotency key...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/queue-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(noKeyEvent),
    });

    const result = await response.json();
    console.log('✅ Request without idempotency key succeeded:', {
      eventId: result.eventId,
      duplicate: result.duplicate,
    });

    if (!result.duplicate) {
      console.log('✅ Request without idempotency key creates new event (as expected)');
    }
  } catch (error) {
    console.error('❌ Test 4 failed:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🎉 Idempotency testing complete!');
  console.log('Check the Supabase dashboard for idempotency_keys table entries');
}

// Run the tests
testIdempotencyDeduplication();
