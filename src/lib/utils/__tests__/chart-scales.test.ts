import { describe, it, expect } from 'vitest';
import { niceLinearTicks, symlog, scaleValue } from '../chart-scales';

describe('niceLinearTicks', () => {
  it('produces d3-style nice ticks for a simple range', () => {
    expect(niceLinearTicks(0, 30, 7)).toEqual([0, 5, 10, 15, 20, 25, 30]);
  });

  it('produces round steps for large ranges (ticks below min are excluded)', () => {
    expect(niceLinearTicks(1, 15000, 5)).toEqual([2000, 4000, 6000, 8000, 10000, 12000, 14000]);
  });

  it('handles small fractional ranges', () => {
    expect(niceLinearTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it('returns empty for degenerate domains', () => {
    expect(niceLinearTicks(5, 5, 5)).toEqual([]);
    expect(niceLinearTicks(10, 0, 5)).toEqual([]);
    expect(niceLinearTicks(0, 10, 0)).toEqual([]);
  });
});

describe('symlog', () => {
  it('matches sign(v) * log1p(|v|)', () => {
    expect(symlog(0)).toBe(0);
    expect(symlog(1)).toBeCloseTo(Math.log(2));
    expect(symlog(-1)).toBeCloseTo(-Math.log(2));
    expect(symlog(99)).toBeCloseTo(Math.log(100));
  });
});

describe('scaleValue', () => {
  it('maps linearly across the range', () => {
    expect(scaleValue(0, 0, 10, 100)).toBe(0);
    expect(scaleValue(5, 0, 10, 100)).toBe(50);
    expect(scaleValue(10, 0, 10, 100)).toBe(100);
  });

  it('maps the domain ends to the range ends in log mode', () => {
    expect(scaleValue(1, 1, 1000, 100, true)).toBe(0);
    expect(scaleValue(1000, 1, 1000, 100, true)).toBeCloseTo(100);
  });

  it('compresses large values in log mode', () => {
    const mid = scaleValue(500, 1, 1000, 100, true);
    // 500 sits at 50% linearly, but ~90% on a symlog curve
    expect(mid).toBeGreaterThan(85);
    expect(mid).toBeLessThan(100);
  });

  it('returns 0 for a degenerate domain instead of dividing by zero', () => {
    expect(scaleValue(5, 5, 5, 100)).toBe(0);
  });
});
