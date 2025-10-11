import {
  assert,
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import {
  type PullRequestData,
  SPAM_THRESHOLDS,
  SpamDetectionService,
} from './spam-detection-service.ts';

// Helper function to create test PR data
function createTestPR(overrides: Partial<PullRequestData> = {}): PullRequestData {
  return {
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
    author: {
      id: 12345,
      login: 'testuser',
      created_at: '2020-01-01T00:00:00Z', // 3+ year old account
      public_repos: 10,
      followers: 50,
      following: 30,
      bio: 'Software developer',
      company: 'Test Company',
      location: 'Test City',
    },
    repository: {
      full_name: 'owner/repo',
    },
    ...overrides,
  };
}

function createSpamPR(overrides: Partial<PullRequestData> = {}): PullRequestData {
  return createTestPR({
    title: 'fix',
    body: '',
    author: {
      id: 99999,
      login: 'newuser123',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago (below 7 day threshold)
      public_repos: 0,
      followers: 0,
      following: 0,
      bio: null,
      company: null,
      location: null,
    },
    changed_files: 1,
    additions: 1,
    deletions: 0,
    ...overrides,
  });
}

Deno.test('SpamDetectionService - detects legitimate PR correctly', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR();

  const result = service.detectSpam(prData);

  assertEquals(result.is_spam, false);
  assert(result.spam_score < SPAM_THRESHOLDS.WARNING);
  assertExists(result.flags.content_score);
  assertExists(result.flags.account_score);
  assertExists(result.flags.pr_score);
  assert(result.confidence > 0);
});

Deno.test('SpamDetectionService - detects spam PR correctly', () => {
  const service = new SpamDetectionService();
  const prData = createSpamPR();

  const result = service.detectSpam(prData);

  assertEquals(result.is_spam, true);
  assert(result.spam_score >= SPAM_THRESHOLDS.LIKELY_SPAM);
  assert(result.reasons.length > 0);
  assert(result.confidence > 0);
});

Deno.test('SpamDetectionService - analyzeContent detects empty description', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({ body: '' });

  const result = service.detectSpam(prData);

  assert(result.flags.content_score >= 40); // Empty description penalty
  assert(result.reasons.includes('Empty description'));
});

Deno.test('SpamDetectionService - analyzeContent detects very short description', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({ body: 'fix bug' });

  const result = service.detectSpam(prData);

  assert(result.flags.content_score >= 30); // Short description penalty
  assert(result.reasons.includes('Very short description'));
});

Deno.test('SpamDetectionService - analyzeContent detects generic titles', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({ title: 'fix' });

  const result = service.detectSpam(prData);

  assert(result.flags.content_score >= 25); // Generic title penalty
  assert(result.reasons.includes('Generic title'));
});

Deno.test('SpamDetectionService - analyzeContent detects spam patterns', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({
    title: 'hacktoberfest contribution',
    body: 'please merge my first contribution',
  });

  const result = service.detectSpam(prData);

  assert(result.flags.content_score > 0); // Spam patterns detected
});

Deno.test('SpamDetectionService - analyzeAccount detects new accounts', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({
    author: {
      id: 99999,
      login: 'newuser',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    },
  });

  const result = service.detectSpam(prData);

  assert(result.flags.account_score >= 50); // New account penalty
  assert(result.reasons.some((r) => r.includes('Very new account')));
});

Deno.test('SpamDetectionService - analyzeAccount detects incomplete profiles', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({
    author: {
      id: 12345,
      login: 'testuser',
      created_at: '2020-01-01T00:00:00Z',
      bio: null,
      company: null,
      location: null,
    },
  });

  const result = service.detectSpam(prData);

  assert(result.flags.account_score >= 20); // Incomplete profile penalty
});

Deno.test('SpamDetectionService - analyzeAccount detects zero activity accounts', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({
    author: {
      id: 12345,
      login: 'testuser',
      created_at: '2020-01-01T00:00:00Z',
      public_repos: 0,
      followers: 0,
    },
  });

  const result = service.detectSpam(prData);

  assert(result.flags.account_score >= 25); // Zero activity penalty
});

Deno.test('SpamDetectionService - analyzePRCharacteristics detects single file with no context', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({
    changed_files: 1,
    body: 'fix',
  });

  const result = service.detectSpam(prData);

  assert(result.flags.pr_score >= 30); // Single file no context penalty
  assert(result.reasons.includes('Single file change with no context'));
});

Deno.test('SpamDetectionService - analyzePRCharacteristics detects large changes with inadequate description', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({
    additions: 150,
    deletions: 50,
    body: 'update code',
  });

  const result = service.detectSpam(prData);

  assert(result.flags.pr_score >= 25); // Large changes inadequate description penalty
});

Deno.test('SpamDetectionService - analyzePRCharacteristics detects very large PRs', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({
    changed_files: 25,
  });

  const result = service.detectSpam(prData);

  assert(result.flags.pr_score >= 20); // Very large PR penalty
});

Deno.test('SpamDetectionService - calculateConfidence returns higher confidence for extreme scores', () => {
  const service = new SpamDetectionService();

  // High spam score
  const spamPR = createSpamPR();
  const spamResult = service.detectSpam(spamPR);
  assert(spamResult.confidence >= 0.7);

  // Low spam score
  const legitimatePR = createTestPR();
  const legitResult = service.detectSpam(legitimatePR);
  assert(legitResult.confidence >= 0.6);
});

Deno.test('SpamDetectionService - handles invalid PR data gracefully', () => {
  const service = new SpamDetectionService();

  const result = service.detectSpam(null as never);

  assertEquals(result.is_spam, false);
  assertEquals(result.spam_score, 0);
  assertEquals(result.confidence, 0);
  assert(result.reasons.includes('Error during spam detection'));
});

Deno.test('SpamDetectionService - handles missing author data', () => {
  const service = new SpamDetectionService();
  const invalidPR = { ...createTestPR(), author: null as never };

  const result = service.detectSpam(invalidPR);

  assertEquals(result.is_spam, false);
  assertEquals(result.spam_score, 0);
  assert(result.reasons.includes('Error during spam detection'));
});

Deno.test('SpamDetectionService - composite scoring works correctly', () => {
  const service = new SpamDetectionService();
  const prData = createTestPR({
    title: 'fix', // High content score
    body: '',
    author: {
      id: 99999,
      login: 'newuser',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // High account score
      public_repos: 0,
      followers: 0,
    },
    changed_files: 1, // High PR score
  });

  const result = service.detectSpam(prData);

  // Composite score should reflect all three components
  assert(result.spam_score > 50);
  assertExists(result.flags.content_score);
  assertExists(result.flags.account_score);
  assertExists(result.flags.pr_score);

  // Should be weighted: 40% content + 40% account + 20% PR
  const expectedScore = Math.round(
    result.flags.content_score * 0.4 +
      result.flags.account_score * 0.4 +
      result.flags.pr_score * 0.2,
  );
  assertEquals(result.spam_score, Math.min(expectedScore, 100));
});

Deno.test('SPAM_THRESHOLDS - have expected values', () => {
  assertEquals(SPAM_THRESHOLDS.LEGITIMATE, 25);
  assertEquals(SPAM_THRESHOLDS.WARNING, 50);
  assertEquals(SPAM_THRESHOLDS.LIKELY_SPAM, 75);
  assertEquals(SPAM_THRESHOLDS.DEFINITE_SPAM, 90);
});
