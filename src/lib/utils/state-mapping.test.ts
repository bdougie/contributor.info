import { describe, it, expect } from 'vitest';
import { getTrendColor } from './state-mapping';

describe('getTrendColor', () => {
  it('should return green color for positive trends', () => {
    expect(getTrendColor(5)).toBe('text-green-600');
    expect(getTrendColor(0.1)).toBe('text-green-600');
    expect(getTrendColor(100)).toBe('text-green-600');
  });

  it('should return red color for negative trends', () => {
    expect(getTrendColor(-3)).toBe('text-red-600');
    expect(getTrendColor(-0.1)).toBe('text-red-600');
    expect(getTrendColor(-100)).toBe('text-red-600');
  });

  it('should return muted color for zero trend', () => {
    expect(getTrendColor(0)).toBe('text-muted-foreground');
  });
});