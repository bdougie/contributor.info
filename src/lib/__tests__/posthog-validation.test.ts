import { describe, it, expect } from 'vitest';

// Test the validation regex directly
describe('PostHog API Key Validation', () => {
  const posthogKeyPattern = /^phc_[A-Za-z0-9]{32,}$/;

  it('should accept valid PostHog API keys', () => {
    const validKeys = [
      'phc_' + 'a'.repeat(32),
      'phc_' + 'A'.repeat(32),
      'phc_' + '1'.repeat(32),
      'phc_' + 'aB1'.repeat(11), // 33 chars
      'phc_1234567890abcdefABCDEF1234567890',
      'phc_' + 'x'.repeat(50), // longer than minimum
    ];

    validKeys.forEach(key => {
      expect(posthogKeyPattern.test(key)).toBe(true);
    });
  });

  it('should reject invalid PostHog API keys', () => {
    const invalidKeys = [
      '', // empty
      'phc_', // too short
      'phc_123', // too short
      'phc_' + 'a'.repeat(31), // one char too short
      'ph_' + 'a'.repeat(32), // wrong prefix
      'PHC_' + 'a'.repeat(32), // wrong case prefix
      'phc' + 'a'.repeat(32), // missing underscore
      'test-key', // completely wrong format
      'phc_' + '!'.repeat(32), // special characters
      'phc_' + 'a b'.repeat(16), // spaces
      'phc_' + 'a-b'.repeat(16), // hyphens
    ];

    invalidKeys.forEach(key => {
      expect(posthogKeyPattern.test(key)).toBe(false);
    });
  });

  it('should handle edge cases', () => {
    // Null/undefined would fail in real usage
    expect(posthogKeyPattern.test(null as any)).toBe(false);
    expect(posthogKeyPattern.test(undefined as any)).toBe(false);
    
    // Numbers would be converted to string
    expect(posthogKeyPattern.test(123 as any)).toBe(false);
    
    // Objects would fail
    expect(posthogKeyPattern.test({} as any)).toBe(false);
  });
});