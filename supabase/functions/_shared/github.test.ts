import { assertEquals, assertThrows } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import {
  getGitHubHeaders,
  getRateLimitInfo,
  checkRateLimit,
  isBotUser,
  GITHUB_API_BASE,
  DEFAULT_USER_AGENT,
} from './github.ts';
// generateTestUser available from '../tests/setup.ts' but not used in these tests

Deno.test('getGitHubHeaders - creates standard headers with token', () => {
  const token = 'test-token';
  const headers = getGitHubHeaders(token);

  const headersObj = headers as Record<string, string>;
  assertEquals(headersObj['Authorization'], 'Bearer test-token');
  assertEquals(headersObj['Accept'], 'application/vnd.github.v3+json');
  assertEquals(headersObj['User-Agent'], DEFAULT_USER_AGENT);
});

Deno.test('getGitHubHeaders - accepts custom user agent', () => {
  const token = 'test-token';
  const customAgent = 'Custom-Bot/1.0';
  const headers = getGitHubHeaders(token, customAgent);

  const headersObj = headers as Record<string, string>;
  assertEquals(headersObj['User-Agent'], customAgent);
});

Deno.test('getGitHubHeaders - throws error without token', () => {
  // Clear environment variable for this test
  const originalToken = Deno.env.get('GITHUB_TOKEN');
  Deno.env.delete('GITHUB_TOKEN');

  try {
    assertThrows(() => {
      getGitHubHeaders();
    }, Error, 'GitHub token not configured');
  } finally {
    // Restore environment variable
    if (originalToken) {
      Deno.env.set('GITHUB_TOKEN', originalToken);
    }
  }
});

Deno.test('getGitHubHeaders - uses environment token when no token provided', () => {
  const envToken = 'env-token';
  const originalToken = Deno.env.get('GITHUB_TOKEN');
  
  try {
    Deno.env.set('GITHUB_TOKEN', envToken);
    const headers = getGitHubHeaders();

    const headersObj = headers as Record<string, string>;
    assertEquals(headersObj['Authorization'], 'Bearer env-token');
  } finally {
    if (originalToken) {
      Deno.env.set('GITHUB_TOKEN', originalToken);
    } else {
      Deno.env.delete('GITHUB_TOKEN');
    }
  }
});

Deno.test('getRateLimitInfo - extracts rate limit from headers', () => {
  const response = new Response('{}', {
    headers: {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4500',
      'x-ratelimit-reset': '1640995200',
      'x-ratelimit-used': '500',
    },
  });

  const rateLimit = getRateLimitInfo(response);

  assertEquals(rateLimit?.limit, 5000);
  assertEquals(rateLimit?.remaining, 4500);
  assertEquals(rateLimit?.reset, 1640995200);
  assertEquals(rateLimit?.used, 500);
});

Deno.test('getRateLimitInfo - returns null for missing headers', () => {
  const response = new Response('{}', {
    headers: {
      'content-type': 'application/json',
    },
  });

  const rateLimit = getRateLimitInfo(response);
  assertEquals(rateLimit, null);
});

Deno.test('getRateLimitInfo - handles missing used header', () => {
  const response = new Response('{}', {
    headers: {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4500',
      'x-ratelimit-reset': '1640995200',
    },
  });

  const rateLimit = getRateLimitInfo(response);
  assertEquals(rateLimit?.used, 0);
});

Deno.test('checkRateLimit - returns false for high remaining requests', () => {
  const response = new Response('{}', {
    headers: {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4500',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
    },
  });

  const isLow = checkRateLimit(response, 100);
  assertEquals(isLow, false);
});

Deno.test('checkRateLimit - returns true for low remaining requests', () => {
  const response = new Response('{}', {
    headers: {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '50',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
    },
  });

  const isLow = checkRateLimit(response, 100);
  assertEquals(isLow, true);
});

Deno.test('checkRateLimit - returns false for missing rate limit headers', () => {
  const response = new Response('{}');

  const isLow = checkRateLimit(response);
  assertEquals(isLow, false);
});

Deno.test('checkRateLimit - accepts custom threshold', () => {
  const response = new Response('{}', {
    headers: {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '75',
      'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
    },
  });

  const isLowDefault = checkRateLimit(response); // default threshold 100
  const isLowCustom = checkRateLimit(response, 50); // custom threshold 50

  assertEquals(isLowDefault, true);
  assertEquals(isLowCustom, false);
});

Deno.test('isBotUser - detects Bot type accounts', () => {
  assertEquals(isBotUser('dependabot', 'Bot'), true);
  assertEquals(isBotUser('github-actions', 'Bot'), true);
});

Deno.test('isBotUser - detects [bot] suffix accounts', () => {
  assertEquals(isBotUser('dependabot[bot]', 'User'), true);
  assertEquals(isBotUser('renovate[bot]', 'User'), true);
});

Deno.test('isBotUser - detects -bot suffix accounts', () => {
  assertEquals(isBotUser('my-service-bot', 'User'), true);
  assertEquals(isBotUser('deploy-bot', 'User'), true);
});

Deno.test('isBotUser - returns false for normal users', () => {
  assertEquals(isBotUser('octocat', 'User'), false);
  assertEquals(isBotUser('testuser', 'User'), false);
  assertEquals(isBotUser('bot-user', 'User'), false); // contains 'bot' but doesn't end with it
});

Deno.test('isBotUser - handles undefined type', () => {
  assertEquals(isBotUser('dependabot[bot]'), true);
  assertEquals(isBotUser('normaluser'), false);
});

Deno.test('API constants - have expected values', () => {
  assertEquals(GITHUB_API_BASE, 'https://api.github.com');
  assertEquals(DEFAULT_USER_AGENT, 'Contributor-Info-Bot');
});