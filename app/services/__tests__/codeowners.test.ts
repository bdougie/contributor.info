import { describe, it, expect } from 'vitest';
import {
  parseCodeOwners,
  matchFilesToOwners,
  calculateOwnershipPercentage,
  extractUsername,
} from '../codeowners';

describe('CODEOWNERS Parser', () => {
  describe('parseCodeOwners', () => {
    it('should parse a simple CODEOWNERS file', () => {
      const content = `
# This is a comment
*.js @javascript-team
*.ts @typescript-team @alice
/docs/ @docs-team
`;

      const result = parseCodeOwners(content);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        pattern: '*.js',
        owners: ['@javascript-team'],
        isTeam: [false],
      });
      expect(result[1]).toEqual({
        pattern: '*.ts',
        owners: ['@typescript-team', '@alice'],
        isTeam: [false, false],
      });
      expect(result[2]).toEqual({
        pattern: '/docs/',
        owners: ['@docs-team'],
        isTeam: [false],
      });
    });

    it('should skip empty lines and comments', () => {
      const content = `
# Comment line

*.js @owner1

# Another comment
`;

      const result = parseCodeOwners(content);
      expect(result).toHaveLength(1);
      expect(result[0].owners).toEqual(['@owner1']);
    });

    it('should identify team mentions', () => {
      const content = `
*.js @org/team-name
*.ts @username
`;

      const result = parseCodeOwners(content);
      expect(result[0].isTeam).toEqual([true]);
      expect(result[1].isTeam).toEqual([false]);
    });
  });

  describe('matchFilesToOwners', () => {
    const codeOwners = [
      { pattern: '*.js', owners: ['@alice'], isTeam: [false] },
      { pattern: '*.ts', owners: ['@bob'], isTeam: [false] },
      { pattern: '/src/', owners: ['@charlie'], isTeam: [false] },
      { pattern: '/src/auth/', owners: ['@alice', '@bob'], isTeam: [false, false] },
    ];

    it('should match files to their owners', () => {
      const files = ['index.js', 'src/app.ts', 'src/auth/login.ts'];
      const result = matchFilesToOwners(files, codeOwners);

      expect(result.get('index.js')).toEqual(new Set(['@alice']));
      expect(result.get('src/app.ts')).toEqual(new Set(['@charlie']));
      expect(result.get('src/auth/login.ts')).toEqual(new Set(['@alice', '@bob']));
    });

    it('should respect last matching pattern wins rule', () => {
      const owners = [
        { pattern: '*.ts', owners: ['@alice'], isTeam: [false] },
        { pattern: '/src/', owners: ['@bob'], isTeam: [false] },
        { pattern: '/src/*.ts', owners: ['@charlie'], isTeam: [false] },
      ];

      const files = ['src/index.ts'];
      const result = matchFilesToOwners(files, owners);

      // The /src/*.ts pattern should win over /src/ and *.ts
      expect(result.get('src/index.ts')).toEqual(new Set(['@charlie']));
    });
  });

  describe('calculateOwnershipPercentage', () => {
    it('should calculate ownership percentages correctly', () => {
      const fileOwners = new Map([
        ['file1.js', new Set(['@alice', '@bob'])],
        ['file2.js', new Set(['@alice'])],
        ['file3.js', new Set(['@bob'])],
      ]);

      const result = calculateOwnershipPercentage(fileOwners);

      expect(result.get('@alice')).toBe(67); // 2 out of 3 files
      expect(result.get('@bob')).toBe(67); // 2 out of 3 files
    });

    it('should handle empty file owners', () => {
      const fileOwners = new Map();
      const result = calculateOwnershipPercentage(fileOwners);

      expect(result.size).toBe(0);
    });
  });

  describe('extractUsername', () => {
    it('should extract username from @mention', () => {
      expect(extractUsername('@alice')).toBe('alice');
      expect(extractUsername('alice')).toBe('alice');
    });

    it('should return null for teams', () => {
      expect(extractUsername('@org/team')).toBeNull();
      expect(extractUsername('org/team')).toBeNull();
    });

    it('should return null for email addresses', () => {
      expect(extractUsername('user@example.com')).toBeNull();
    });
  });
});
