import { describe, it, expect } from 'vitest';
import {
  getDiffSymbol,
  getDiffBackgroundColor,
  getDiffTextColor,
  getDiffBorderColor,
} from '../code-styling';

describe('code-styling utilities', () => {
  describe('getDiffSymbol', () => {
    it('returns correct symbols for diff line types', () => {
      expect(getDiffSymbol('addition')).toBe('+');
      expect(getDiffSymbol('deletion')).toBe('-');
      expect(getDiffSymbol('unchanged')).toBe(' ');
    });
  });

  describe('getDiffBackgroundColor', () => {
    it('returns correct background colors for diff line types', () => {
      expect(getDiffBackgroundColor('addition')).toBe('bg-green-50 dark:bg-green-950');
      expect(getDiffBackgroundColor('deletion')).toBe('bg-red-50 dark:bg-red-950');
      expect(getDiffBackgroundColor('unchanged')).toBe('bg-transparent');
    });
  });

  describe('getDiffTextColor', () => {
    it('returns correct text colors for diff line types', () => {
      expect(getDiffTextColor('addition')).toBe('text-green-700 dark:text-green-300');
      expect(getDiffTextColor('deletion')).toBe('text-red-700 dark:text-red-300');
      expect(getDiffTextColor('unchanged')).toBe('text-foreground');
    });
  });

  describe('getDiffBorderColor', () => {
    it('returns correct border colors for diff line types', () => {
      expect(getDiffBorderColor('addition')).toBe('border-l-green-500');
      expect(getDiffBorderColor('deletion')).toBe('border-l-red-500');
      expect(getDiffBorderColor('unchanged')).toBe('border-l-transparent');
    });
  });
});
