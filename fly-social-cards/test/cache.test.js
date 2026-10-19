import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateCacheKey,
  publicUrlFor,
  ageFromLastModified,
  CACHE_TTL,
  STORAGE_BUCKET,
} from '../src/cache.js';

describe('generateCacheKey', () => {
  it('builds a deterministic storage path from chart params', () => {
    const key = generateCacheKey('lottery-factor', {
      owner: 'continuedev',
      repo: 'continue',
      timeRange: '30',
      type: 'donut',
    });
    expect(key).toBe('lottery-factor/continuedev/continue/30-donut.png');
  });

  it('lowercases owner, repo and distribution type', () => {
    const key = generateCacheKey('distribution', {
      owner: 'ContinueDev',
      repo: 'Continue',
      timeRange: '90',
      type: 'Bar',
    });
    expect(key).toBe('distribution/continuedev/continue/90-bar.png');
  });

  it('applies the route defaults when timeRange and type are omitted', () => {
    // Must match the path social-meta.ts builds for crawler-facing URLs.
    const key = generateCacheKey('health-factors', { owner: 'vitejs', repo: 'vite' });
    expect(key).toBe('health-factors/vitejs/vite/30-donut.png');
  });
});

describe('publicUrlFor', () => {
  const original = process.env.SUPABASE_URL;

  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co/';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = original;
  });

  it('points at the public object in the chart-screenshots bucket', () => {
    expect(publicUrlFor('lottery-factor/a/b/30-donut.png')).toBe(
      `https://example.supabase.co/storage/v1/object/public/${STORAGE_BUCKET}/lottery-factor/a/b/30-donut.png`
    );
  });

  it('returns null when Supabase is not configured', () => {
    delete process.env.SUPABASE_URL;
    expect(publicUrlFor('x.png')).toBeNull();
  });
});

describe('ageFromLastModified', () => {
  it('treats a missing or malformed header as stale', () => {
    expect(ageFromLastModified(null)).toBe(Infinity);
    expect(ageFromLastModified('not a date')).toBe(Infinity);
  });

  it('measures age against now', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toUTCString();
    const age = ageFromLastModified(oneHourAgo);
    expect(age).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    expect(age).toBeLessThan(CACHE_TTL);
  });
});
