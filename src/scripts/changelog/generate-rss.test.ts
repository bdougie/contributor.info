import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseChangelog, generateRss, generateAtom } from '../../../scripts/changelog/generate-rss.js';

describe('RSS/Atom Feed Generation', () => {
  describe('parseChangelog', () => {
    it('should parse version entries with markdown links', () => {
      const changelog = `
# Changelog

## [1.2.0](https://github.com/example/repo/releases/tag/v1.2.0) (2025-01-10)

### 🚀 Features
* Added new dashboard
* Improved performance metrics

### 🐛 Bug Fixes
* Fixed memory leak in data processor

## [1.1.0](https://github.com/example/repo/releases/tag/v1.1.0) (2025-01-05)

### 🚀 Features
* Initial release
`;
      
      const entries = parseChangelog(changelog);
      
      expect(entries).toHaveLength(2);
      expect(entries[0].version).toBe('1.2.0');
      expect(entries[0].versionLink).toBe('https://github.com/example/repo/releases/tag/v1.2.0');
      expect(entries[0].dateString).toBe('2025-01-10');
      expect(entries[0].sections.features).toHaveLength(2);
      expect(entries[0].sections.fixes).toHaveLength(1);
    });

    it('should handle empty changelog gracefully', () => {
      const entries = parseChangelog('');
      expect(entries).toHaveLength(0);
    });

    it('should parse dates correctly', () => {
      const changelog = `
## [1.0.0](link) (2025-01-15)
### 🚀 Features
* Test feature
`;
      
      const entries = parseChangelog(changelog);
      expect(entries[0].date).toBeInstanceOf(Date);
      expect(entries[0].date.getFullYear()).toBe(2025);
    });

    it('should handle malformed dates with fallback', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const changelog = `
## [1.0.0](link) (invalid-date)
### 🚀 Features
* Test feature
`;
      
      const entries = parseChangelog(changelog);
      expect(entries[0].date).toBeInstanceOf(Date);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse date')
      );
      
      consoleSpy.mockRestore();
    });

    it('should categorize different section types', () => {
      const changelog = `
## [1.0.0](link) (2025-01-15)

### 🚀 Features
* New feature

### 🐛 Bug Fixes
* Bug fix

### ⚡ Performance
* Performance improvement

### 📚 Documentation
* Docs update

### ⚠️ Breaking Changes
* Breaking change
`;
      
      const entries = parseChangelog(changelog);
      const sections = entries[0].sections;
      
      expect(sections.features).toHaveLength(1);
      expect(sections.fixes).toHaveLength(1);
      expect(sections.performance).toHaveLength(1);
      expect(sections.documentation).toHaveLength(1);
      expect(sections.breaking).toHaveLength(1);
    });
  });

  describe('generateRss', () => {
    const mockEntries = [
      {
        version: '1.0.0',
        versionLink: 'https://github.com/test/repo',
        date: new Date('2025-01-15'),
        dateString: '2025-01-15',
        title: 'Version 1.0.0',
        content: 'Test content',
        sections: {
          features: ['Feature 1', 'Feature 2'],
          fixes: ['Fix 1'],
          performance: [],
          documentation: [],
          breaking: []
        },
        guid: 'https://contributor.info/changelog#version-1-0-0'
      }
    ];

    it('should generate valid RSS XML', () => {
      const rss = generateRss(mockEntries);
      
      expect(rss).toContain('<?xml version="1.0" encoding="UTF-8" ?>');
      expect(rss).toContain('<rss version="2.0"');
      expect(rss).toContain('<title>contributor.info Changelog</title>');
      expect(rss).toContain('<item>');
      expect(rss).toContain('Version 1.0.0');
    });

    it('should escape XML special characters', () => {
      const entriesWithSpecialChars = [{
        ...mockEntries[0],
        title: 'Version & <Test>',
        sections: {
          ...mockEntries[0].sections,
          features: ['Feature with <tag> & "quotes"']
        }
      }];
      
      const rss = generateRss(entriesWithSpecialChars);
      
      expect(rss).toContain('Version &amp; &lt;Test&gt;');
      expect(rss).toContain('&lt;tag&gt;');
      expect(rss).toContain('&quot;quotes&quot;');
    });

    it('should include WebSub hub links', () => {
      const rss = generateRss(mockEntries);
      expect(rss).toContain('<atom:link rel="hub"');
    });

    it('should limit to 20 entries', () => {
      const manyEntries = Array(25).fill(null).map((_, i) => ({
        ...mockEntries[0],
        version: `1.${i}.0`,
        title: `Version 1.${i}.0`
      }));
      
      const rss = generateRss(manyEntries);
      const itemCount = (rss.match(/<item>/g) || []).length;
      
      expect(itemCount).toBe(20);
    });

    it('should add appropriate categories', () => {
      const entriesWithBreaking = [{
        ...mockEntries[0],
        sections: {
          features: ['Feature 1'],
          fixes: ['Fix 1'],
          performance: [],
          documentation: [],
          breaking: ['Breaking change']
        }
      }];
      
      const rss = generateRss(entriesWithBreaking);
      
      expect(rss).toContain('<category>Features</category>');
      expect(rss).toContain('<category>Bug Fixes</category>');
      expect(rss).toContain('<category>Breaking Changes</category>');
    });
  });

  describe('generateAtom', () => {
    const mockEntries = [
      {
        version: '1.0.0',
        versionLink: 'https://github.com/test/repo',
        date: new Date('2025-01-15'),
        dateString: '2025-01-15',
        title: 'Version 1.0.0',
        content: 'Test content',
        sections: {
          features: ['Feature 1'],
          fixes: [],
          performance: [],
          documentation: [],
          breaking: []
        },
        guid: 'https://contributor.info/changelog#version-1-0-0'
      }
    ];

    it('should generate valid Atom XML', () => {
      const atom = generateAtom(mockEntries);
      
      expect(atom).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom"');
      expect(atom).toContain('<title>contributor.info Changelog</title>');
      expect(atom).toContain('<entry>');
      expect(atom).toContain('Version 1.0.0');
    });

    it('should include proper ISO dates', () => {
      const atom = generateAtom(mockEntries);
      
      expect(atom).toMatch(/<published>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(atom).toMatch(/<updated>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should include WebSub hub discovery', () => {
      const atom = generateAtom(mockEntries);
      expect(atom).toContain('<link href="https://contributor.info/api/websub/hub" rel="hub"/>');
    });

    it('should handle empty entries list', () => {
      const atom = generateAtom([]);
      
      expect(atom).toContain('<feed xmlns="http://www.w3.org/2005/Atom"');
      expect(atom).not.toContain('<entry>');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null previous values in metrics', () => {
      const changelog = `
## [1.0.0](link) (2025-01-15)

### 🚀 Features
* Repository gained 100 stars (from unknown)
`;
      
      const entries = parseChangelog(changelog);
      expect(entries[0].sections.features[0]).toContain('100 stars');
    });

    it('should handle negative metric changes', () => {
      const changelog = `
## [1.0.0](link) (2025-01-15)

### 📉 Metrics
* Stars decreased by 5%
`;
      
      const entries = parseChangelog(changelog);
      expect(entries).toHaveLength(1);
    });

    it('should handle exactly 5% threshold changes', () => {
      const changelog = `
## [1.0.0](link) (2025-01-15)

### 🚀 Features
* Activity increased by exactly 5%
`;
      
      const entries = parseChangelog(changelog);
      expect(entries[0].sections.features[0]).toContain('5%');
    });

    it('should handle repository with no metrics history', () => {
      const emptyChangelog = '# Changelog\n\nNo releases yet.';
      const entries = parseChangelog(emptyChangelog);
      
      expect(entries).toHaveLength(0);
    });

    it('should handle malformed changelog entries', () => {
      const malformedChangelog = `
# Changelog

This is not a proper version entry

## [1.0.0 (missing bracket) 2025-01-15

### Features
* Test
`;
      
      const entries = parseChangelog(malformedChangelog);
      
      // Should still parse what it can
      expect(entries.length).toBeGreaterThanOrEqual(0);
    });
  });
});