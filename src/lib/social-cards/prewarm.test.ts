import { describe, it, expect } from 'vitest';
import { chartCardUrlFor } from './prewarm';

describe('chartCardUrlFor', () => {
  it('maps a chart tab to the Fly chart URL', () => {
    expect(chartCardUrlFor('/continuedev/continue/lottery-factor')).toBe(
      'https://contributor-info-social-cards.fly.dev/charts/lottery-factor?owner=continuedev&repo=continue'
    );
  });

  it('renames the health tab to the health-factors chart', () => {
    expect(chartCardUrlFor('/vitejs/vite/health/')).toBe(
      'https://contributor-info-social-cards.fly.dev/charts/health-factors?owner=vitejs&repo=vite'
    );
  });

  it('returns null for non-chart paths', () => {
    expect(chartCardUrlFor('/')).toBeNull();
    expect(chartCardUrlFor('/vitejs')).toBeNull();
    expect(chartCardUrlFor('/vitejs/vite')).toBeNull();
    expect(chartCardUrlFor('/vitejs/vite/contributions')).toBeNull();
  });
});
