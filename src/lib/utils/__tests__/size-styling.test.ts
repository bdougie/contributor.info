import { describe, it, expect } from 'vitest';
import { getIconSize, getTextSize, getPadding, getSpacing } from '../size-styling';

describe('size-styling utilities', () => {
  describe('getIconSize', () => {
    it('returns correct icon size classes', () => {
      expect(getIconSize('small')).toBe('h-3 w-3');
      expect(getIconSize('medium')).toBe('h-4 w-4');
      expect(getIconSize('large')).toBe('h-6 w-6');
    });

    it('defaults to medium size when no parameter provided', () => {
      expect(getIconSize()).toBe('h-4 w-4');
    });
  });

  describe('getTextSize', () => {
    it('returns correct text size classes', () => {
      expect(getTextSize('small')).toBe('text-sm');
      expect(getTextSize('medium')).toBe('text-base');
      expect(getTextSize('large')).toBe('text-lg');
    });

    it('defaults to medium size when no parameter provided', () => {
      expect(getTextSize()).toBe('text-base');
    });
  });

  describe('getPadding', () => {
    it('returns correct padding classes', () => {
      expect(getPadding('small')).toBe('p-1');
      expect(getPadding('medium')).toBe('p-2');
      expect(getPadding('large')).toBe('p-4');
    });

    it('defaults to medium padding when no parameter provided', () => {
      expect(getPadding()).toBe('p-2');
    });
  });

  describe('getSpacing', () => {
    it('returns correct gap classes', () => {
      expect(getSpacing('small')).toBe('gap-1');
      expect(getSpacing('medium')).toBe('gap-2');
      expect(getSpacing('large')).toBe('gap-4');
    });

    it('defaults to medium spacing when no parameter provided', () => {
      expect(getSpacing()).toBe('gap-2');
    });
  });
});
