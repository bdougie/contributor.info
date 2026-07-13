import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';

// The module reads Supabase env vars at load time, so they must exist before import.
const { mockRpc } = vi.hoisted(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  return { mockRpc: vi.fn() };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ rpc: mockRpc })),
}));

import { handler } from '../api-trending-repositories.mts';

interface TrendingRepoRow {
  repository_id: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  trending_score: string;
  star_change: string;
  pr_change: string;
  contributor_change: string;
  last_activity: string;
  avatar_url: string | null;
  html_url: string;
}

const sampleRepo: TrendingRepoRow = {
  repository_id: 'repo-1',
  owner: 'test-owner',
  name: 'test-repo',
  description: 'A test repository',
  language: 'TypeScript',
  stars: 1234,
  trending_score: '42.5',
  star_change: '10',
  pr_change: '5',
  contributor_change: '2',
  last_activity: '2026-07-01T00:00:00Z',
  avatar_url: 'https://example.com/avatar.png',
  html_url: 'https://github.com/test-owner/test-repo',
};

interface MakeEventOptions {
  httpMethod?: string;
  queryStringParameters?: Record<string, string>;
}

function makeEvent(options: MakeEventOptions = {}): HandlerEvent {
  const queryStringParameters = options.queryStringParameters ?? {};
  const rawQuery = new URLSearchParams(queryStringParameters).toString();

  return {
    rawUrl: `https://example.com/.netlify/functions/api-trending-repositories?${rawQuery}`,
    rawQuery,
    path: '/.netlify/functions/api-trending-repositories',
    httpMethod: options.httpMethod ?? 'GET',
    headers: {},
    multiValueHeaders: {},
    queryStringParameters,
    multiValueQueryStringParameters: {},
    body: null,
    isBase64Encoded: false,
  };
}

const context = {} as HandlerContext;

function mockSuccessfulRpc(repos: TrendingRepoRow[] = [sampleRepo]): void {
  mockRpc.mockImplementation((fnName: string) => {
    if (fnName === 'get_trending_repositories_with_fallback') {
      return Promise.resolve({ data: repos, error: null });
    }
    if (fnName === 'get_trending_statistics') {
      return Promise.resolve({
        data: [
          {
            total_trending_repos: repos.length,
            avg_trending_score: 42.5,
            top_language: 'TypeScript',
            total_star_growth: 10,
            total_new_contributors: 2,
          },
        ],
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

async function invoke(event: HandlerEvent): Promise<HandlerResponse> {
  const response = await handler(event, context, () => undefined);
  if (!response) {
    throw new Error('Handler returned no response');
  }
  return response;
}

describe('api-trending-repositories handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CDN caching headers', () => {
    it('sets CDN and browser cache headers on successful responses', async () => {
      mockSuccessfulRpc();

      const response = await invoke(makeEvent());

      expect(response.statusCode).toBe(200);
      expect(response.headers?.['Cache-Control']).toBe('public, max-age=60');
      expect(response.headers?.['Netlify-CDN-Cache-Control']).toBe(
        'public, s-maxage=300, stale-while-revalidate=3600'
      );
    });

    it('does not cache database error responses', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'db down', details: null, hint: null, code: '500' },
      });

      const response = await invoke(makeEvent());

      expect(response.statusCode).toBe(500);
      expect(response.headers?.['Cache-Control']).toBe('no-store');
      expect(response.headers?.['Netlify-CDN-Cache-Control']).toBeUndefined();
    });

    it('does not cache unexpected error responses', async () => {
      mockRpc.mockRejectedValue(new Error('network exploded'));

      const response = await invoke(makeEvent());

      expect(response.statusCode).toBe(500);
      expect(response.headers?.['Cache-Control']).toBe('no-store');
      expect(response.headers?.['Netlify-CDN-Cache-Control']).toBeUndefined();
    });

    it('does not cache method-not-allowed responses', async () => {
      const response = await invoke(makeEvent({ httpMethod: 'POST' }));

      expect(response.statusCode).toBe(405);
      expect(response.headers?.['Cache-Control']).toBe('no-store');
      expect(response.headers?.['Netlify-CDN-Cache-Control']).toBeUndefined();
    });
  });

  describe('query parameter bounding', () => {
    it('coerces junk parameters to safe defaults so the CDN cache is not fragmented', async () => {
      mockSuccessfulRpc();

      const response = await invoke(
        makeEvent({
          queryStringParameters: {
            period: 'bogus',
            limit: 'NaN-city',
            minStars: '-50',
            sort: 'drop-tables',
          },
        })
      );

      expect(response.statusCode).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith('get_trending_repositories_with_fallback', {
        p_time_period: '7 days',
        p_limit: 50,
        p_language: undefined,
        p_min_stars: 0,
      });

      const body = JSON.parse(response.body ?? '{}');
      expect(body.metadata.period).toBe('7d');
      expect(body.metadata.limit).toBe(50);
      expect(body.metadata.minStars).toBe(0);
      expect(body.metadata.sort).toBe('trending_score');
    });

    it('caps limit at 100', async () => {
      mockSuccessfulRpc();

      const response = await invoke(makeEvent({ queryStringParameters: { limit: '9999' } }));

      expect(response.statusCode).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith(
        'get_trending_repositories_with_fallback',
        expect.objectContaining({ p_limit: 100 })
      );
    });

    it('passes through valid parameters', async () => {
      mockSuccessfulRpc();

      const response = await invoke(
        makeEvent({
          queryStringParameters: {
            period: '30d',
            limit: '25',
            language: 'TypeScript',
            minStars: '100',
            sort: 'star_change',
          },
        })
      );

      expect(response.statusCode).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith('get_trending_repositories_with_fallback', {
        p_time_period: '30 days',
        p_limit: 25,
        p_language: 'TypeScript',
        p_min_stars: 100,
      });

      const body = JSON.parse(response.body ?? '{}');
      expect(body.metadata.sort).toBe('star_change');
    });
  });

  describe('response shape', () => {
    it('returns mapped repositories and statistics', async () => {
      mockSuccessfulRpc();

      const response = await invoke(makeEvent());
      const body = JSON.parse(response.body ?? '{}');

      expect(body.repositories).toHaveLength(1);
      expect(body.repositories[0]).toMatchObject({
        id: 'repo-1',
        owner: 'test-owner',
        name: 'test-repo',
        trending_score: 42.5,
      });
      expect(body.metadata.statistics).toMatchObject({ top_language: 'TypeScript' });
      expect(typeof body.generated_at).toBe('string');
    });
  });
});
