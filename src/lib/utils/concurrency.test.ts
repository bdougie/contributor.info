import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('maps all items and preserves input order', () => {
    return mapWithConcurrency([3, 1, 2], 2, (n) => Promise.resolve(n * 10)).then((results) => {
      expect(results).toEqual([30, 10, 20]);
    });
  });

  it('never runs more than the limit concurrently', () => {
    let active = 0;
    let maxActive = 0;
    return mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, () => {
      active++;
      maxActive = Math.max(maxActive, active);
      return Promise.resolve()
        .then(() => Promise.resolve())
        .then(() => {
          active--;
        });
    }).then(() => {
      expect(maxActive).toBeLessThanOrEqual(2);
    });
  });

  it('returns an empty array for empty input', () => {
    return mapWithConcurrency([], 4, (n: number) => Promise.resolve(n)).then((results) => {
      expect(results).toEqual([]);
    });
  });

  it('passes the item index to the mapper', () => {
    return mapWithConcurrency(['a', 'b'], 1, (item, index) =>
      Promise.resolve(`${item}${index}`)
    ).then((results) => {
      expect(results).toEqual(['a0', 'b1']);
    });
  });
});
