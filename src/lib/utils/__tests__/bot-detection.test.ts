import { describe, it, expect } from 'vitest';
import {
  detectBot,
  isBot,
  getGitHubUserType,
  getKnownBotUsernames,
  validateBotClassification,
  type GitHubUser,
  type DatabaseContributor,
} from '../bot-detection';

describe('Bot Detection Utility', () => {
  describe('detectBot function', () => {
    it('should detect bots from GitHub API type', () => {
      const githubUser: GitHubUser = {
        type: 'Bot',
        login: 'some-user',
      };

      const result = detectBot({ githubUser });

      expect(result.isBot).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.detectedBy).toContain('github_type');
      expect(result.reasoning).toContain('GitHub API reports user type as Bot');
    });

    it('should detect bots from [bot] username pattern', () => {
      const githubUser: GitHubUser = {
        type: 'User',
        login: 'dependabot[bot]',
      };

      const result = detectBot({ githubUser });

      expect(result.isBot).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.detectedBy).toContain('username_pattern');
      expect(result.reasoning).toContain('Username matches bot pattern');
    });

    it('should detect bots from database flag', () => {
      const contributor: DatabaseContributor = {
        is_bot: true,
        username: 'regular-user',
      };

      const result = detectBot({ contributor });

      expect(result.isBot).toBe(true);
      expect(result.detectedBy).toContain('database_flag');
      expect(result.reasoning).toContain('Database contributor record flagged as bot');
    });

    it('should combine multiple detection methods', () => {
      const githubUser: GitHubUser = {
        type: 'Bot',
        login: 'github-actions[bot]',
      };

      const result = detectBot({ githubUser });

      expect(result.isBot).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.detectedBy).toContain('github_type');
      expect(result.detectedBy).toContain('username_pattern');
      expect(result.detectedBy).toHaveLength(2);
    });

    it('should prioritize GitHub API over database flag', () => {
      const githubUser: GitHubUser = {
        type: 'Bot',
        login: 'confirmed-bot',
      };
      const contributor: DatabaseContributor = {
        is_bot: false,
        username: 'confirmed-bot',
      };

      const result = detectBot({ githubUser, contributor });

      expect(result.isBot).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.reasoning).toContain('Database flag overridden');
    });

    it('should not detect regular users as bots', () => {
      const githubUser: GitHubUser = {
        type: 'User',
        login: 'regular-user',
      };

      const result = detectBot({ githubUser });

      expect(result.isBot).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.detectedBy).toHaveLength(0);
      expect(result.reasoning).toBe('No bot indicators detected');
    });

    it('should handle minimal input data', () => {
      const result = detectBot({ username: 'test-user' });

      expect(result.isBot).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.detectedBy).toHaveLength(0);
    });

    it('should handle empty input', () => {
      const result = detectBot({});

      expect(result.isBot).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.detectedBy).toHaveLength(0);
    });
  });

  describe('Known bot pattern detection', () => {
    const knownBotPatterns = [
      'dependabot[bot]',
      'github-actions[bot]',
      'renovate[bot]',
      'codecov[bot]',
      'stale[bot]',
      'greenkeeper[bot]',
      'snyk-bot',
      'allcontributors[bot]',
      'dependabot-preview[bot]',
      'renovate-bot',
    ];

    it.each(knownBotPatterns)('should detect %s as bot', (botUsername) => {
      const result = detectBot({ username: botUsername });
      expect(result.isBot).toBe(true);
      expect(result.detectedBy).toContain('username_pattern');
    });

    it('should detect bots with case variations', () => {
      const result = detectBot({ username: 'DEPENDABOT[BOT]' });
      expect(result.isBot).toBe(true);
    });

    it('should detect dependabot variations', () => {
      const variations = ['dependabot', 'dependabot-test', 'dependabot123'];

      variations.forEach((username) => {
        const result = detectBot({ username });
        expect(result.isBot).toBe(true);
        expect(result.detectedBy).toContain('username_pattern');
      });
    });

    it('should detect renovate variations', () => {
      const variations = ['renovate', 'renovate-bot', 'renovate-test'];

      variations.forEach((username) => {
        const result = detectBot({ username });
        expect(result.isBot).toBe(true);
        expect(result.detectedBy).toContain('username_pattern');
      });
    });

    it('should not flag regular users with similar names', () => {
      const regularUsers = [
        'user-dependabot', // contains dependabot but doesn't start with it
        'user-renovate', // doesn't start with renovate
        'github-user', // doesn't start with github-actions
        'my-bot', // doesn't match any pattern
        'botuser', // has bot but doesn't end with [bot]
        'developer', // regular username
      ];

      regularUsers.forEach((username) => {
        const result = detectBot({ username });
        expect(result.isBot).toBe(false);
      });
    });
  });

  describe('isBot helper function', () => {
    it('should return true for bots', () => {
      const githubUser: GitHubUser = { type: 'Bot', login: 'test-bot' };
      expect(isBot({ githubUser })).toBe(true);
    });

    it('should return false for humans', () => {
      const githubUser: GitHubUser = { type: 'User', login: 'human-user' };
      expect(isBot({ githubUser })).toBe(false);
    });
  });

  describe('getGitHubUserType function', () => {
    it('should return Bot for detected bots', () => {
      const githubUser: GitHubUser = { type: 'Bot', login: 'test-bot' };
      expect(getGitHubUserType({ githubUser })).toBe('Bot');
    });

    it('should return User for humans', () => {
      const githubUser: GitHubUser = { type: 'User', login: 'human-user' };
      expect(getGitHubUserType({ githubUser })).toBe('User');
    });
  });

  describe('getKnownBotUsernames function', () => {
    it('should return an array of known bot usernames', () => {
      const knownBots = getKnownBotUsernames();

      expect(Array.isArray(knownBots)).toBe(true);
      expect(knownBots.length).toBeGreaterThan(0);
      expect(knownBots).toContain('dependabot[bot]');
      expect(knownBots).toContain('github-actions[bot]');
      expect(knownBots).toContain('renovate[bot]');
    });
  });

  describe('validateBotClassification function', () => {
    it('should validate consistent classification', () => {
      const githubUser: GitHubUser = { type: 'Bot', login: 'test-bot[bot]' };
      const contributor: DatabaseContributor = { is_bot: true, username: 'test-bot[bot]' };

      const result = validateBotClassification(githubUser, contributor);

      expect(result.isConsistent).toBe(true);
      expect(result.recommendation).toBe(true);
      expect(result.reason).toBe('Classifications match');
    });

    it('should detect inconsistent classification and recommend GitHub value', () => {
      const githubUser: GitHubUser = { type: 'Bot', login: 'confirmed-bot' };
      const contributor: DatabaseContributor = { is_bot: false, username: 'confirmed-bot' };

      const result = validateBotClassification(githubUser, contributor);

      expect(result.isConsistent).toBe(false);
      expect(result.recommendation).toBe(true);
      expect(result.reason).toContain('recommend GitHub value');
    });

    it('should handle human users correctly', () => {
      const githubUser: GitHubUser = { type: 'User', login: 'human-user' };
      const contributor: DatabaseContributor = { is_bot: false, username: 'human-user' };

      const result = validateBotClassification(githubUser, contributor);

      expect(result.isConsistent).toBe(true);
      expect(result.recommendation).toBe(false);
      expect(result.reason).toBe('Classifications match');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle undefined values gracefully', () => {
      const result = detectBot({
        githubUser: { type: undefined, login: '' },
        contributor: { is_bot: undefined, username: undefined },
      });

      expect(result.isBot).toBe(false);
      expect(result.confidence).toBe('low');
    });

    it('should handle null values gracefully', () => {
      const result = detectBot({
        // @ts-expect-error - Testing runtime safety
        githubUser: null,
        // @ts-expect-error - Testing runtime safety
        contributor: null,
      });

      expect(result.isBot).toBe(false);
      expect(result.confidence).toBe('low');
    });

    it('should handle mixed case GitHub API types', () => {
      const result = detectBot({
        githubUser: { type: 'bot', login: 'test' },
      });

      // Should not match because GitHub API is case-sensitive
      expect(result.isBot).toBe(false);
    });

    it('should handle string type input', () => {
      const result = detectBot({
        type: 'Bot',
        username: 'test-bot',
      });

      expect(result.isBot).toBe(true);
      expect(result.detectedBy).toContain('github_type');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle the GraphQL sync issue scenario', () => {
      // This simulates the issue described in #692 where GraphQL defaults is_bot: false
      const githubUser: GitHubUser = { login: 'dependabot[bot]' }; // No type from GraphQL
      const contributor: DatabaseContributor = { is_bot: false, username: 'dependabot[bot]' };

      const result = detectBot({ githubUser, contributor });

      expect(result.isBot).toBe(true);
      expect(result.detectedBy).toContain('username_pattern');
      expect(result.reasoning).toContain('Database flag overridden');
    });

    it('should handle activity processing scenario', () => {
      // This simulates use-pr-activity.ts scenario
      const pullRequestUser = {
        type: 'Bot' as const,
        login: 'github-actions[bot]',
      };

      const result = detectBot({ githubUser: pullRequestUser });

      expect(result.isBot).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.detectedBy).toContain('github_type');
      expect(result.detectedBy).toContain('username_pattern');
    });

    it('should handle database lookup scenario', () => {
      // This simulates when we only have database data
      const dbContributor: DatabaseContributor = {
        is_bot: true,
        username: 'stale[bot]',
      };

      const result = detectBot({ contributor: dbContributor });

      expect(result.isBot).toBe(true);
      expect(result.detectedBy).toContain('database_flag');
      expect(result.detectedBy).toContain('username_pattern');
    });
  });
});
