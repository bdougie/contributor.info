import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateDetector, SPAM_PATTERNS } from '../templates/CommonTemplates.ts';

describe('TemplateDetector', () => {
  let detector: TemplateDetector;

  beforeEach(() => {
    detector = new TemplateDetector();
  });

  describe('detectTemplateMatch', () => {
    it('should detect exact template matches', () => {
      const testCases = ['update', 'fix', 'change', 'added my name', 'hello world'];

      testCases.forEach((template) => {
        const result = detector.detectTemplateMatch(template);
        expect(result.is_match).toBe(true);
        expect(result.similarity_score).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should detect case-insensitive matches', () => {
      const result = detector.detectTemplateMatch('UPDATE');
      expect(result.is_match).toBe(true);
      expect(result.similarity_score).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect empty descriptions as spam', () => {
      const result = detector.detectTemplateMatch('');
      expect(result.is_match).toBe(true);
      expect(result.template_id).toBe('empty_description');
      expect(result.similarity_score).toBe(1.0);
    });

    it('should detect whitespace-only descriptions', () => {
      const result = detector.detectTemplateMatch('   ');
      expect(result.is_match).toBe(true);
      expect(result.template_id).toBe('empty_description');
    });

    it('should detect Hacktoberfest patterns', () => {
      const hacktoberfestCases = [
        'added my name to contributors',
        'Hacktoberfest contribution',
        'name added',
        'added name to list',
      ];

      hacktoberfestCases.forEach((text) => {
        const result = detector.detectTemplateMatch(text);
        expect(result.is_match).toBe(true);
        expect(result.template_id).toBe('hacktoberfest');
      });
    });

    it('should detect first contribution patterns', () => {
      const firstContribCases = [
        'my first contribution',
        'first commit ever',
        'hello world program',
        'My First PR',
      ];

      firstContribCases.forEach((text) => {
        const result = detector.detectTemplateMatch(text);
        expect(result.is_match).toBe(true);
        expect(result.template_id).toBe('first_contrib');
      });
    });

    it('should detect minimal effort patterns', () => {
      const minimalCases = ['fix.', 'update.', 'change', 'test'];

      minimalCases.forEach((text) => {
        const result = detector.detectTemplateMatch(text);
        expect(result.is_match).toBe(true);
        // These will be detected as exact matches or minimal_effort patterns
        expect(['exact_match', 'minimal_effort'].includes(result.template_id || '')).toBe(true);
      });
    });

    it('should detect single character spam', () => {
      const singleCharCases = ['a', 'x', '🎉', '123'];

      singleCharCases.forEach((text) => {
        const result = detector.detectTemplateMatch(text);
        expect(result.is_match).toBe(true);
        expect(result.template_id).toBe('single_char');
      });
    });

    it('should not flag legitimate descriptions', () => {
      const legitimateCases = [
        'Fixed authentication bug that prevented users from logging in',
        'Add support for TypeScript configuration files',
        'Refactor user management service to improve performance',
        'Update documentation with new API endpoints',
        'Remove deprecated methods from payment processor',
        'Implement dark mode toggle for user interface',
      ];

      legitimateCases.forEach((text) => {
        const result = detector.detectTemplateMatch(text);
        expect(result.is_match).toBe(false);
      });
    });

    it('should handle similarity matching', () => {
      const result = detector.detectTemplateMatch('updated readme file');

      // Should detect similarity to "update" but not exact match
      if (result.is_match) {
        expect(result.similarity_score).toBeLessThan(1.0);
        expect(result.similarity_score).toBeGreaterThan(0.5);
      }
    });

    it('should handle special characters and punctuation', () => {
      const result = detector.detectTemplateMatch('fix!!!');
      expect(result.is_match).toBe(true); // Should still detect "fix"
    });
  });

  describe('getAllMatches', () => {
    it('should return all matching templates sorted by similarity', () => {
      const matches = detector.getAllMatches('fix');

      // Should find some matches for "fix"
      expect(matches.length).toBeGreaterThan(0);

      // Should be sorted by similarity (descending)
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].similarity).toBeGreaterThanOrEqual(matches[i].similarity);
      }
    });

    it('should return empty array for no matches', () => {
      const matches = detector.getAllMatches(
        'comprehensive technical implementation of advanced features'
      );
      expect(matches.length).toBe(0);
    });

    it('should handle empty input', () => {
      const matches = detector.getAllMatches('');
      expect(matches).toEqual([]);
    });
  });

  describe('spam patterns', () => {
    it('should test all spam patterns work correctly', () => {
      const testCases = [
        { pattern: SPAM_PATTERNS.MINIMAL_EFFORT, text: 'fix', shouldMatch: true },
        {
          pattern: SPAM_PATTERNS.MINIMAL_EFFORT,
          text: 'Fixed authentication bug',
          shouldMatch: false,
        },
        {
          pattern: SPAM_PATTERNS.HACKTOBERFEST,
          text: 'hacktoberfest contribution',
          shouldMatch: true,
        },
        {
          pattern: SPAM_PATTERNS.HACKTOBERFEST,
          text: 'legitimate feature addition',
          shouldMatch: false,
        },
        { pattern: SPAM_PATTERNS.FIRST_CONTRIB, text: 'my first contribution', shouldMatch: true },
        {
          pattern: SPAM_PATTERNS.FIRST_CONTRIB,
          text: 'experienced developer update',
          shouldMatch: false,
        },
        { pattern: SPAM_PATTERNS.SINGLE_CHAR, text: 'x', shouldMatch: true },
        { pattern: SPAM_PATTERNS.SINGLE_CHAR, text: 'comprehensive update', shouldMatch: false },
        { pattern: SPAM_PATTERNS.MEANINGLESS, text: 'done', shouldMatch: true },
        {
          pattern: SPAM_PATTERNS.MEANINGLESS,
          text: 'Implementation completed successfully',
          shouldMatch: false,
        },
      ];

      testCases.forEach(({ pattern, text, shouldMatch }) => {
        const matches = pattern.test(text);
        expect(matches).toBe(shouldMatch);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle very long descriptions', () => {
      const longText = 'a'.repeat(10000);
      const result = detector.detectTemplateMatch(longText);

      // Should not crash and should return a result
      expect(result).toBeDefined();
      expect(typeof result.is_match).toBe('boolean');
    });

    it('should handle unicode characters', () => {
      const unicodeText = '🚀 Added emoji support 🎉';
      const result = detector.detectTemplateMatch(unicodeText);

      expect(result).toBeDefined();
      expect(typeof result.is_match).toBe('boolean');
    });

    it('should handle mixed case and spacing', () => {
      const messyText = '  FiX  ';
      const result = detector.detectTemplateMatch(messyText);

      // Should normalize and still detect "fix"
      expect(result.is_match).toBe(true);
    });

    it('should handle null and undefined gracefully', () => {
      const result1 = detector.detectTemplateMatch(null as unknown as string);
      const result2 = detector.detectTemplateMatch(undefined as unknown as string);

      expect(result1.is_match).toBe(true); // Empty content is spam
      expect(result2.is_match).toBe(true); // Empty content is spam
    });
  });
});
