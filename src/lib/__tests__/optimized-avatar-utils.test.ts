import { describe, it, expect } from 'vitest';
import {
  optimizeAvatarUrl,
  generateFallbackText,
  getAvatarSizeConfig,
  getFallbackTextSize,
  shouldLoadImmediately,
  getLoadingAttribute,
} from '../optimized-avatar-utils';

describe('optimizeAvatarUrl', () => {
  it('optimizes GitHub avatar URLs with size parameter', () => {
    const result = optimizeAvatarUrl(
      'https://avatars.githubusercontent.com/u/123456',
      64
    );
    expect(result).toBe('https://avatars.githubusercontent.com/u/123456?s=64&v=4');
  });

  it('preserves existing query parameters in GitHub URLs', () => {
    const result = optimizeAvatarUrl(
      'https://avatars.githubusercontent.com/u/123456?v=3',
      48
    );
    expect(result).toBe('https://avatars.githubusercontent.com/u/123456?s=48&v=4');
  });

  it('returns non-GitHub URLs unchanged', () => {
    const url = 'https://example.com/avatar.jpg';
    const result = optimizeAvatarUrl(url, 64);
    expect(result).toBe(url);
  });

  it('handles undefined src', () => {
    const result = optimizeAvatarUrl(undefined, 64);
    expect(result).toBeUndefined();
  });

  it('handles empty string src', () => {
    const result = optimizeAvatarUrl('', 64);
    expect(result).toBe('');
  });

  it('handles invalid URLs gracefully', () => {
    const result = optimizeAvatarUrl('not-a-valid-url', 64);
    expect(result).toBe('not-a-valid-url');
  });

  it('handles relative URLs', () => {
    const result = optimizeAvatarUrl('/images/avatar.jpg', 64);
    expect(result).toBe('/images/avatar.jpg');
  });

  it('handles different GitHub subdomains correctly', () => {
    const result = optimizeAvatarUrl(
      'https://avatars0.githubusercontent.com/u/123456',
      32
    );
    // Should not optimize non-standard GitHub avatar domains
    expect(result).toBe('https://avatars0.githubusercontent.com/u/123456');
  });
});

describe('generateFallbackText', () => {
  it('returns custom fallback when provided', () => {
    const result = generateFallbackText('John Doe', 'XX', false);
    expect(result).toBe('XX');
  });

  it('returns question mark when _error occurred', () => {
    const result = generateFallbackText('John Doe', undefined, true);
    expect(result).toBe('?');
  });

  it('generates initials from two-word names', () => {
    const result = generateFallbackText('John Doe');
    expect(result).toBe('JD');
  });

  it('generates initials from multi-word names', () => {
    const result = generateFallbackText('John Middle Doe');
    expect(result).toBe('JM');
  });

  it('handles single-word names', () => {
    const result = generateFallbackText('John');
    expect(result).toBe('JO');
  });

  it('handles single character names', () => {
    const result = generateFallbackText('J');
    expect(result).toBe('J');
  });

  it('handles empty string', () => {
    const result = generateFallbackText('');
    expect(result).toBe('');
  });

  it('handles names with extra spaces', () => {
    const result = generateFallbackText('  John   Doe  ');
    expect(result).toBe('JD');
  });

  it('handles lowercase input and converts to uppercase', () => {
    const result = generateFallbackText('jane smith');
    expect(result).toBe('JS');
  });

  it('handles special characters', () => {
    const result = generateFallbackText('John-Paul O\'Connor');
    expect(result).toBe('JO');
  });

  it('handles numbers in names', () => {
    const result = generateFallbackText('User 123');
    expect(result).toBe('U1');
  });
});

describe('getAvatarSizeConfig', () => {
  it('returns correct config for standard sizes', () => {
    const testCases = [
      { size: 16, expectedClass: 'h-4 w-4' },
      { size: 20, expectedClass: 'h-5 w-5' },
      { size: 24, expectedClass: 'h-6 w-6' },
      { size: 32, expectedClass: 'h-8 w-8' },
      { size: 40, expectedClass: 'h-10 w-10' },
      { size: 48, expectedClass: 'h-12 w-12' },
      { size: 64, expectedClass: 'h-16 w-16' },
      { size: 80, expectedClass: 'h-20 w-20' },
      { size: 96, expectedClass: 'h-24 w-24' },
      { size: 128, expectedClass: 'h-32 w-32' },
    ];

    testCases.forEach(({ size, expectedClass }) => {
      const result = getAvatarSizeConfig(size);
      expect(result.className).toBe(expectedClass);
      expect(result.style).toEqual({
        width: `${size}px`,
        height: `${size}px`,
      });
    });
  });

  it('returns default config for non-standard sizes', () => {
    const result = getAvatarSizeConfig(55);
    expect(result.className).toBe('h-10 w-10');
    expect(result.style).toEqual({
      width: '55px',
      height: '55px',
    });
  });
});

describe('getFallbackTextSize', () => {
  it('returns text-xs for small avatars (≤24px)', () => {
    expect(getFallbackTextSize(16)).toBe('text-xs');
    expect(getFallbackTextSize(20)).toBe('text-xs');
    expect(getFallbackTextSize(24)).toBe('text-xs');
  });

  it('returns text-xs for medium-small avatars (≤32px)', () => {
    expect(getFallbackTextSize(32)).toBe('text-xs');
  });

  it('returns text-sm for medium avatars', () => {
    expect(getFallbackTextSize(40)).toBe('text-sm');
    expect(getFallbackTextSize(48)).toBe('text-sm');
    expect(getFallbackTextSize(64)).toBe('text-sm');
  });

  it('returns text-base for large avatars (≥80px)', () => {
    expect(getFallbackTextSize(80)).toBe('text-base');
    expect(getFallbackTextSize(96)).toBe('text-base');
    expect(getFallbackTextSize(128)).toBe('text-base');
  });
});

describe('shouldLoadImmediately', () => {
  it('returns true when lazy is false', () => {
    expect(shouldLoadImmediately(false, false)).toBe(true);
    expect(shouldLoadImmediately(false, true)).toBe(true);
  });

  it('returns true when priority is true', () => {
    expect(shouldLoadImmediately(true, true)).toBe(true);
  });

  it('returns false when lazy is true and priority is false', () => {
    expect(shouldLoadImmediately(true, false)).toBe(false);
  });
});

describe('getLoadingAttribute', () => {
  it('returns eager when priority is true', () => {
    expect(getLoadingAttribute(true)).toBe('eager');
  });

  it('returns lazy when priority is false', () => {
    expect(getLoadingAttribute(false)).toBe('lazy');
  });
});