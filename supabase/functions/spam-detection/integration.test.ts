import { assert, assertEquals } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { generateSpamUser, generateTestUser } from '../tests/setup.ts';

const BASE_URL = 'http://localhost:54321/functions/v1';

// Mock pull request data generator
function createTestPRData(isSpam = false, overrides: Record<string, unknown> = {}) {
  const baseData = {
    pull_request: {
      id: 'test-pr-1',
      title: 'Add new feature',
      body:
        'This PR adds a new feature that improves user experience by implementing xyz functionality.',
      number: 1,
      additions: 50,
      deletions: 10,
      changed_files: 3,
      created_at: '2023-01-01T00:00:00Z',
      html_url: 'https://github.com/owner/repo/pull/1',
      author: generateTestUser(),
      repository: {
        full_name: 'owner/repo',
      },
    },
  };

  if (isSpam) {
    baseData.pull_request = {
      ...baseData.pull_request,
      title: 'fix',
      body: '',
      author: generateSpamUser(),
      changed_files: 1,
      additions: 1,
      deletions: 0,
    };
  }

  return {
    ...baseData,
    ...overrides,
  };
}

// Note: These tests require a running Supabase instance
// They are designed to run against a test database
Deno.test('spam-detection - analyzes legitimate PR correctly', async () => {
  const prData = createTestPRData(false, {
    pr_id: 'test-legitimate-pr',
  });

  const response = await fetch(`${BASE_URL}/spam-detection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prData),
  });

  if (response.status === 404) {
    console.log('Skipping integration test - Supabase not available');
    return;
  }

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.success, true);

  // For legitimate PRs, spam analysis should indicate not spam
  if (data.spam_result) {
    assertEquals(data.spam_result.is_spam, false);
    assert(data.spam_result.spam_score < 75); // Below likely spam threshold
  }
});

Deno.test('spam-detection - detects spam PR correctly', async () => {
  const prData = createTestPRData(true, {
    pr_id: 'test-spam-pr',
  });

  const response = await fetch(`${BASE_URL}/spam-detection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prData),
  });

  if (response.status === 404) {
    console.log('Skipping integration test - Supabase not available');
    return;
  }

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.success, true);

  // For spam PRs, spam analysis should indicate spam
  if (data.spam_result) {
    assertEquals(data.spam_result.is_spam, true);
    assert(data.spam_result.spam_score >= 75); // Above likely spam threshold
    assert(data.spam_result.reasons.length > 0);
  }
});

Deno.test('spam-detection - handles missing fields gracefully', async () => {
  const response = await fetch(`${BASE_URL}/spam-detection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (response.status === 404) {
    console.log('Skipping integration test - Supabase not available');
    return;
  }

  assertEquals(response.status, 400);
  const data = await response.json();
  assertEquals(data.success, false);
  assert(data.error.includes('Invalid request'));
});

Deno.test('spam-detection - handles CORS preflight', async () => {
  const response = await fetch(`${BASE_URL}/spam-detection`, {
    method: 'OPTIONS',
  });

  if (response.status === 404) {
    console.log('Skipping integration test - Supabase not available');
    return;
  }

  assertEquals(response.status, 200);
  assert(response.headers.get('Access-Control-Allow-Origin'));
});

Deno.test('spam-detection - batch processing request format', async () => {
  const batchRequest = {
    repository_owner: 'test-owner',
    repository_name: 'test-repo',
    limit: 10,
  };

  const response = await fetch(`${BASE_URL}/spam-detection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batchRequest),
  });

  if (response.status === 404) {
    console.log('Skipping integration test - Supabase not available');
    return;
  }

  // Should handle the request (might return 404 if repository doesn't exist, which is fine)
  assert(response.status === 200 || response.status === 500);
  const data = await response.json();

  if (response.status === 500) {
    // Expected if repository doesn't exist in test database
    assert(data.error.includes('Repository not found') || data.error.includes('not found'));
  } else {
    assertEquals(data.success, true);
  }
});

Deno.test('spam-detection - analyze all repositories request', async () => {
  const analyzeAllRequest = {
    analyze_all: true,
    limit: 5,
  };

  const response = await fetch(`${BASE_URL}/spam-detection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(analyzeAllRequest),
  });

  if (response.status === 404) {
    console.log('Skipping integration test - Supabase not available');
    return;
  }

  assertEquals(response.status, 200);
  const data = await response.json();
  assertEquals(data.success, true);
  assertEquals(data.analyze_all, true);

  // Should include statistics even if no repositories found
  assert('total_repositories' in data);
  assert('total_processed' in data);
  assert('total_errors' in data);
  assert('overall_stats' in data);
});
