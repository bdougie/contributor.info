import { describe, it, expect } from 'vitest';
import {
  getPercentageBgColor,
  getValueCategoryColor,
  getValidationBorderClass,
} from './threshold-styling';

describe('getPercentageBgColor', () => {
  it('should return red for critical percentages', () => {
    expect(getPercentageBgColor(95)).toBe('bg-red-500');
    expect(getPercentageBgColor(91)).toBe('bg-red-500');
    expect(getPercentageBgColor(100)).toBe('bg-red-500');
  });

  it('should return amber for warning percentages', () => {
    expect(getPercentageBgColor(80)).toBe('bg-amber-500');
    expect(getPercentageBgColor(90)).toBe('bg-amber-500');
    expect(getPercentageBgColor(76)).toBe('bg-amber-500');
  });

  it('should return green for good percentages', () => {
    expect(getPercentageBgColor(50)).toBe('bg-green-500');
    expect(getPercentageBgColor(75)).toBe('bg-green-500');
    expect(getPercentageBgColor(0)).toBe('bg-green-500');
  });
});

describe('getValueCategoryColor', () => {
  it('should return Red for low values', () => {
    expect(getValueCategoryColor(25)).toBe('Red');
    expect(getValueCategoryColor(30)).toBe('Red');
    expect(getValueCategoryColor(0)).toBe('Red');
  });

  it('should return Orange for medium-low values', () => {
    expect(getValueCategoryColor(45)).toBe('Orange');
    expect(getValueCategoryColor(50)).toBe('Orange');
    expect(getValueCategoryColor(31)).toBe('Orange');
  });

  it('should return Blue for medium-high values', () => {
    expect(getValueCategoryColor(65)).toBe('Blue');
    expect(getValueCategoryColor(70)).toBe('Blue');
    expect(getValueCategoryColor(51)).toBe('Blue');
  });

  it('should return Green for high values', () => {
    expect(getValueCategoryColor(85)).toBe('Green');
    expect(getValueCategoryColor(71)).toBe('Green');
    expect(getValueCategoryColor(100)).toBe('Green');
  });
});

describe('getValidationBorderClass', () => {
  it('should return red border for errors', () => {
    expect(getValidationBorderClass(true, false)).toBe('border-red-500');
    expect(getValidationBorderClass(true, true)).toBe('border-red-500');
  });

  it('should return green border for valid state', () => {
    expect(getValidationBorderClass(false, true)).toBe('border-green-500');
  });

  it('should return empty string for neutral state', () => {
    expect(getValidationBorderClass(false, false)).toBe('');
  });
});
