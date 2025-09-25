import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Core Web Vitals', () => {
  const urls = ['http://localhost:5173/', 'http://localhost:5173/vercel/next.js'];

  it.skip('should meet LCP, CLS, and FCP thresholds', () => {
    urls.forEach((url) => {
      try {
        const result = execSync(
          `npx lighthouse ${url} --only-categories=performance --chrome-flags="--headless" --output=json --quiet`,
          {
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024,
          }
        );

        const data = JSON.parse(result);
        const metrics = data.audits.metrics.details.items[0];

        const lcp = metrics.largestContentfulPaint;
        const cls = metrics.cumulativeLayoutShift;
        const fcp = metrics.firstContentfulPaint;

        expect(lcp).toBeLessThan(2500);
        expect(cls).toBeLessThan(0.1);
        expect(fcp).toBeLessThan(1800);

        const score = data.categories.performance.score * 100;
        expect(score).toBeGreaterThanOrEqual(90);
      } catch (error) {
        console.error('Failed to test %s:', url, error);
        throw error;
      }
    });
  });
});
