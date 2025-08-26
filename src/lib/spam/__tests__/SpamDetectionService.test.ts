import { describe, it, expect, beforeEach } from 'vitest';
import { SpamDetectionService } from '../SpamDetectionService';
import { PullRequestData, SPAM_THRESHOLDS } from '../types';

// Mock data for testing
const createMockPR = (overrides: Partial<PullRequestData> = {}): PullRequestData => ({
  id: '1',
  title: 'Fix bug in authentication',
  body: 'This PR fixes a critical bug in the authentication system where users were unable to log in.',
  number: 123,
  additions: 10,
  deletions: 5,
  changed_files: 2,
  created_at: '2024-01-15T10:00:00Z',
  html_url: 'https://github.com/owner/repo/pull/123',
  author: {
    id: 12345,
    login: 'gooddev',
    created_at: '2022-01-01T00:00:00Z',
    public_repos: 15,
    followers: 25,
    following: 30,
    bio: 'Software developer with 5 years experience',
    company: 'Tech Corp',
    location: 'San Francisco',
  },
  repository: {
    full_name: 'owner/repo',
  },
  ...overrides,
});

describe('SpamDetectionService', () => {
  let spamDetectionService: SpamDetectionService;

  beforeEach(() => {
    spamDetectionService = new SpamDetectionService();
  });

  describe('detectSpam', () => {
    it('should classify legitimate PR as not spam', async () => {
      const pr = createMockPR();
      const result = await spamDetectionService.detectSpam(pr);

      expect(result.is_spam).toBe(false);
      expect(result.spam_score).toBeLessThan(SPAM_THRESHOLDS.WARNING);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.flags).toBeDefined();
    });

    it('should detect template-matched spam PR', async () => {
      const spamPR = createMockPR({
        title: 'update',
        body: '',
        author: {
          id: 99999,
          login: 'spammer123',
          created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          public_repos: 0,
          followers: 0,
          following: 0,
        },
      });

      const result = await spamDetectionService.detectSpam(spamPR);

      expect(result.is_spam).toBe(true);
      expect(result.spam_score).toBeGreaterThan(SPAM_THRESHOLDS.LIKELY_SPAM);
      expect(result.flags.template_match?.is_match).toBe(true);
      expect(result.reasons.join(' ')).toMatch(/template|pattern|spam/i);
    });

    it('should detect new account with poor content quality', async () => {
      const newAccountPR = createMockPR({
        title: 'fix',
        body: 'fix',
        author: {
          id: 88888,
          login: 'newuser2024',
          created_at: new Date().toISOString(), // Today
          public_repos: 0,
          followers: 0,
          following: 0,
        },
      });

      const result = await spamDetectionService.detectSpam(newAccountPR);

      expect(result.spam_score).toBeGreaterThan(SPAM_THRESHOLDS.WARNING);
      expect(result.flags.account_flags?.is_new_account).toBe(true);
      expect(result.flags.content_quality?.quality_score).toBeLessThan(0.5);
    });

    it('should handle Hacktoberfest spam patterns', async () => {
      const hacktoberfestSpam = createMockPR({
        title: 'Added my name',
        body: 'added my name to contributors list',
        additions: 1,
        deletions: 0,
        changed_files: 1,
        author: {
          id: 77777,
          login: 'hacktober2024',
          created_at: '2024-09-01T00:00:00Z', // September (typical Hacktoberfest prep)
          public_repos: 0,
          followers: 0,
          following: 0,
        },
      });

      const result = await spamDetectionService.detectSpam(hacktoberfestSpam);

      expect(result.spam_score).toBeGreaterThan(SPAM_THRESHOLDS.WARNING);
      expect(result.flags.template_match?.is_match).toBe(true);
      expect(result.reasons.join(' ')).toMatch(/template|spam/i);
    });

    it('should detect empty or minimal content', async () => {
      const emptyContentPR = createMockPR({
        title: 'Update',
        body: '',
        author: {
          id: 66666,
          login: 'minimalist',
          created_at: '2024-01-01T00:00:00Z',
          public_repos: 1,
          followers: 0,
          following: 0,
        },
      });

      const result = await spamDetectionService.detectSpam(emptyContentPR);

      expect(result.spam_score).toBeGreaterThan(SPAM_THRESHOLDS.WARNING);
      expect(result.flags.content_quality?.description_length).toBe(0);
      expect(result.reasons).toContain('Empty description');
    });

    it('should have lower spam score for established accounts', async () => {
      const establishedAccountPR = createMockPR({
        title: 'Minor update',
        body: 'Small formatting change',
        author: {
          id: 11111,
          login: 'veteran_dev',
          created_at: '2020-01-01T00:00:00Z', // 4+ years old
          public_repos: 50,
          followers: 100,
          following: 80,
          bio: 'Senior software engineer at Big Tech',
          company: 'Big Tech Corp',
          location: 'Seattle',
        },
      });

      const result = await spamDetectionService.detectSpam(establishedAccountPR);

      expect(result.spam_score).toBeLessThan(SPAM_THRESHOLDS.WARNING);
      expect(result.flags.account_flags?.is_new_account).toBe(false);
      expect(result.flags.account_flags?.has_profile__data).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const invalidPR = {} as PullRequestData;
      const result = await spamDetectionService.detectSpam(invalidPR);

      expect(result.spam_score).toBe(0);
      expect(result.is_spam).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.reasons).toContain('Error during spam detection');
    });
  });

  describe('detectSpamBatch', () => {
    it('should process multiple PRs correctly', async () => {
      const prs = [
        createMockPR({ id: '1' }),
        createMockPR({
          id: '2',
          title: 'fix',
          body: '',
          author: {
            id: 99998,
            login: 'spammer',
            created_at: new Date().toISOString(),
            public_repos: 0,
            followers: 0,
            following: 0,
          },
        }),
        createMockPR({ id: '3' }),
      ];

      const results = await spamDetectionService.detectSpamBatch(prs);

      expect(results).toHaveLength(3);
      expect(results[0].is_spam).toBe(false); // Legitimate PR
      expect(results[1].is_spam).toBe(true); // Spam PR
      expect(results[2].is_spam).toBe(false); // Legitimate PR
    });

    it('should handle empty batch', async () => {
      const results = await spamDetectionService.detectSpamBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('getDetectionStats', () => {
    it('should calculate statistics correctly', async () => {
      const results = [
        { spam_score: 10, is_spam: false, confidence: 0.8 } as any,
        { spam_score: 85, is_spam: true, confidence: 0.9 } as any,
        { spam_score: 30, is_spam: false, confidence: 0.6 } as any,
        { spam_score: 95, is_spam: true, confidence: 0.95 } as any,
      ];

      const stats = spamDetectionService.getDetectionStats(results);

      expect(stats.total).toBe(4);
      expect(stats.spam_count).toBe(2);
      expect(stats.spam_percentage).toBe(50);
      expect(stats.avg_score).toBe(55); // (10 + 85 + 30 + 95) / 4
      expect(stats.avg_confidence).toBe(0.81); // (0.8 + 0.9 + 0.6 + 0.95) / 4
      expect(stats.by_threshold.legitimate).toBe(1); // score <= 25
      expect(stats.by_threshold.warning).toBe(1); // 25 < score <= 50
      expect(stats.by_threshold.likely_spam).toBe(0); // 50 < score <= 75
      expect(stats.by_threshold.definite_spam).toBe(2); // score > 75
    });
  });

  describe('performance', () => {
    it('should process PR within acceptable time limit', async () => {
      const pr = createMockPR();
      const startTime = Date.now();

      await spamDetectionService.detectSpam(pr);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(100); // Should be under 100ms
    });

    it('should handle large batch efficiently', async () => {
      const prs = Array.from({ length: 50 }, (_, i) => createMockPR({ id: i.toString() }));
      const startTime = Date.now();

      await spamDetectionService.detectSpamBatch(prs);

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(5000); // Should handle 50 PRs in under 5 seconds
    });
  });
});
