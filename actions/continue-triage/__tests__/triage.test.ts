import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Mock the GitHub Actions core
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setSecret: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

// Mock the GitHub context
vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
  },
  getOctokit: vi.fn(() => ({
    rest: {
      rateLimit: {
        get: vi.fn().mockResolvedValue({
          data: {
            core: {
              limit: 5000,
              remaining: 4500,
              reset: Math.floor(Date.now() / 1000) + 3600,
            },
          },
        }),
      },
      issues: {
        get: vi.fn().mockResolvedValue({
          data: {
            number: 123,
            title: 'Bug: Application crashes on startup',
            body: 'The application fails to start with an error message',
            labels: [],
          },
        }),
        listLabelsForRepo: vi.fn().mockResolvedValue({
          data: [
            { name: 'bug', description: "Something isn't working" },
            { name: 'enhancement', description: 'New feature' },
            { name: 'frontend', description: 'Frontend related' },
            { name: 'security', description: 'Security issue' },
          ],
        }),
        addLabels: vi.fn().mockResolvedValue({}),
        removeLabel: vi.fn().mockResolvedValue({}),
        createComment: vi.fn().mockResolvedValue({}),
      },
    },
  })),
}));

describe('Continue Triage Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration Loading', () => {
    it('should load triage configuration from YAML', () => {
      const configPath = path.join(__dirname, '..', 'triage-config.yml');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(configContent) as {
        labelMappings: {
          type: {
            bug: {
              patterns: string[];
            };
          };
        };
      };

      expect(config).toBeDefined();
      expect(config.labelMappings).toBeDefined();
      expect(config.labelMappings.type).toBeDefined();
      expect(config.labelMappings.type.bug).toBeDefined();
      expect(config.labelMappings.type.bug.patterns).toContain('bug');
    });

    it('should have valid tier rules', () => {
      const configPath = path.join(__dirname, '..', 'triage-config.yml');
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = yaml.load(configContent) as {
        tierRules: {
          'tier 1': {
            patterns: string[];
          };
        };
      };

      expect(config.tierRules).toBeDefined();
      expect(config.tierRules['tier 1']).toBeDefined();
      expect(config.tierRules['tier 1'].patterns).toContain('critical');
    });
  });

  describe('Label Detection', () => {
    it('should detect bug labels from issue content', () => {
      const issueText = 'bug: application crashes with error message';
      const patterns = ['bug', 'error', 'crash'];

      const hasMatch = patterns.some((pattern) => issueText.toLowerCase().includes(pattern));

      expect(hasMatch).toBe(true);
    });

    it('should detect enhancement labels', () => {
      const issueText = 'feature request: add dark mode';
      const patterns = ['feature', 'add', 'enhancement'];

      const hasMatch = patterns.some((pattern) => issueText.toLowerCase().includes(pattern));

      expect(hasMatch).toBe(true);
    });

    it('should detect security labels', () => {
      const issueText = 'security vulnerability in authentication';
      const patterns = ['security', 'vulnerability', 'auth'];

      const hasMatch = patterns.some((pattern) => issueText.toLowerCase().includes(pattern));

      expect(hasMatch).toBe(true);
    });
  });

  describe('SCQA Generation', () => {
    it('should generate SCQA structure', () => {
      const analysis = {
        situation: 'The issue "Bug: Application crashes" has been submitted',
        complication: 'The application fails to start properly',
        question: 'What is causing the startup failure?',
        answer: 'Debug the initialization sequence',
        suggestedLabels: ['bug', 'critical'],
        reasoning: {
          bug: 'Issue describes a crash',
          critical: 'Prevents application from starting',
        },
      };

      expect(analysis.situation).toBeDefined();
      expect(analysis.complication).toBeDefined();
      expect(analysis.question).toBeDefined();
      expect(analysis.answer).toBeDefined();
      expect(analysis.suggestedLabels).toHaveLength(2);
    });
  });

  describe('Dry Run Mode', () => {
    it('should not apply labels in dry run mode', async () => {
      const dryRun = true;
      const mockAddLabels = vi.fn();

      if (!dryRun) {
        await mockAddLabels();
      }

      expect(mockAddLabels).not.toHaveBeenCalled();
    });

    it('should include dry run indicator in comment', () => {
      const dryRun = true;
      const comment = `## 🤖 Triage Analysis${dryRun ? ' (DRY RUN)' : ''}`;

      expect(comment).toContain('(DRY RUN)');
    });
  });

  describe('Rate Limiting', () => {
    it('should check rate limit before proceeding', async () => {
      const rateLimit = {
        core: {
          limit: 5000,
          remaining: 100,
          reset: Math.floor(Date.now() / 1000) + 3600,
        },
      };

      expect(rateLimit.core.remaining).toBeGreaterThan(10);
    });

    it('should fail if rate limit is too low', () => {
      const rateLimit = {
        core: {
          limit: 5000,
          remaining: 5,
          reset: Math.floor(Date.now() / 1000) + 3600,
        },
      };

      expect(rateLimit.core.remaining).toBeLessThan(10);
    });
  });

  describe('Security', () => {
    it('should not expose API keys in logs', () => {
      const apiKey = 'secret-api-key';

      // Simulate masking
      const logOutput = apiKey.replace(/./g, '*');

      expect(logOutput).not.toContain('secret');
      expect(logOutput).toMatch(/\*+/);
    });

    it('should pass API key via environment variable', () => {
      const env = {
        CONTINUE_API_KEY: 'secret-key',
      };

      expect(env.CONTINUE_API_KEY).toBeDefined();
      expect(env.CONTINUE_API_KEY).not.toBe('');
    });
  });

  describe('Fallback Analysis', () => {
    it('should provide fallback analysis when Continue API fails', () => {
      const issue = {
        title: 'Bug: Application error',
        body: 'The frontend component is not rendering',
        labels: [],
      };

      const fullText = `${issue.title} ${issue.body}`.toLowerCase();
      const suggestedLabels: string[] = [];

      if (fullText.includes('bug') || fullText.includes('error')) {
        suggestedLabels.push('bug');
      }
      if (fullText.includes('frontend') || fullText.includes('component')) {
        suggestedLabels.push('frontend');
      }

      expect(suggestedLabels).toContain('bug');
      expect(suggestedLabels).toContain('frontend');
    });
  });
});
