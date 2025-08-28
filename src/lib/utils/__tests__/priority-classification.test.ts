import { describe, it, expect } from 'vitest';
import {
  getPriorityLevel,
  getConfidenceByVariant,
  getImageLoadingStrategy,
  CONFIDENCE_BY_VARIANT,
} from '../priority-classification';

describe('priority-classification utilities', () => {
  describe('getPriorityLevel', () => {
    it('returns "high" for scores >= 70', () => {
      expect(getPriorityLevel(70)).toBe('high');
      expect(getPriorityLevel(85)).toBe('high');
      expect(getPriorityLevel(100)).toBe('high');
    });

    it('returns "medium" for scores >= 50 and < 70', () => {
      expect(getPriorityLevel(50)).toBe('medium');
      expect(getPriorityLevel(60)).toBe('medium');
      expect(getPriorityLevel(69)).toBe('medium');
    });

    it('returns "low" for scores < 50', () => {
      expect(getPriorityLevel(0)).toBe('low');
      expect(getPriorityLevel(25)).toBe('low');
      expect(getPriorityLevel(49)).toBe('low');
    });

    it('handles edge cases', () => {
      expect(getPriorityLevel(-10)).toBe('low');
      expect(getPriorityLevel(150)).toBe('high');
    });
  });

  describe('getConfidenceByVariant', () => {
    it('returns correct confidence for known variants', () => {
      expect(getConfidenceByVariant('low-confidence')).toBe(40);
      expect(getConfidenceByVariant('high-priority')).toBe(95);
      expect(getConfidenceByVariant('default')).toBe(85);
    });

    it('returns default confidence for unknown variants', () => {
      expect(getConfidenceByVariant('unknown-variant')).toBe(85);
      expect(getConfidenceByVariant('')).toBe(85);
    });

    it('has consistent constant values', () => {
      expect(CONFIDENCE_BY_VARIANT['low-confidence']).toBe(40);
      expect(CONFIDENCE_BY_VARIANT['high-priority']).toBe(95);
      expect(CONFIDENCE_BY_VARIANT.default).toBe(85);
    });
  });

  describe('getImageLoadingStrategy', () => {
    it('returns "eager" when priority is true', () => {
      expect(getImageLoadingStrategy(true)).toBe('eager');
      expect(getImageLoadingStrategy(true, 'lazy')).toBe('eager');
      expect(getImageLoadingStrategy(true, 'lazy', true)).toBe('eager');
    });

    it('returns specified loading strategy when provided', () => {
      expect(getImageLoadingStrategy(false, 'lazy')).toBe('lazy');
      expect(getImageLoadingStrategy(false, 'eager')).toBe('eager');
      expect(getImageLoadingStrategy(undefined, 'lazy')).toBe('lazy');
    });

    it('returns "lazy" when lazy flag is true and no other overrides', () => {
      expect(getImageLoadingStrategy(false, undefined, true)).toBe('lazy');
      expect(getImageLoadingStrategy(undefined, undefined, true)).toBe('lazy');
    });

    it('returns "eager" as default when no parameters are set', () => {
      expect(getImageLoadingStrategy()).toBe('eager');
      expect(getImageLoadingStrategy(false)).toBe('eager');
      expect(getImageLoadingStrategy(false, undefined, false)).toBe('eager');
    });

    it('follows precedence order: priority > loading > lazy > default', () => {
      // Priority overrides everything
      expect(getImageLoadingStrategy(true, 'lazy', true)).toBe('eager');

      // Loading overrides lazy and default
      expect(getImageLoadingStrategy(false, 'eager', true)).toBe('eager');

      // Lazy overrides default
      expect(getImageLoadingStrategy(false, undefined, true)).toBe('lazy');
    });
  });
});
