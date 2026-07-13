import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('maps all items and preserves input order', async () => {
    const results = await mapWithConcurrency([3, 1, 2], 2, async (n) => n * 10);
    expect(results).toEqual([30, 10, 20]);
  });

  it('never runs more than the limit concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      await Promise.resolve();
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('returns an empty array for empty input', async () => {
    const results = await mapWithConcurrency([], 4, async (n: number) => n);
    expect(results).toEqual([]);
  });

  it('passes the item index to the mapper', async () => {
    const results = await mapWithConcurrency(
      ['a', 'b'],
      1,
      async (item, index) => `${item}${index}`
    );
    expect(results).toEqual(['a0', 'b1']);
  });
});
