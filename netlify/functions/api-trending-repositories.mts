import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use SUPABASE_URL first (server-side convention), fallback to VITE_ prefix
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Lazy initialization to avoid crashing at module load time
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL, SUPABASE_ANON_KEY)');
  }
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

const VALID_PERIODS = ['24h', '7d', '30d'] as const;
type Period = (typeof VALID_PERIODS)[number];

const VALID_SORTS = ['trending_score', 'star_change', 'pr_change', 'contributor_change'] as const;
type SortField = (typeof VALID_SORTS)[number];

interface TrendingQuery {
  period: Period;
  limit: number;
  language?: string;
  minStars: number;
  sort: SortField;
}

interface TrendingRepoRow {
  repository_id: string;
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number | null;
  trending_score: number | string | null;
  star_change: number | string | null;
  pr_change: number | string | null;
  contributor_change: number | string | null;
  last_activity: string | null;
  avatar_url: string | null;
  html_url: string | null;
}

function toNumber(value: number | string | null): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePeriod(value: string | null): Period {
  return (VALID_PERIODS as readonly string[]).includes(value ?? '') ? (value as Period) : '7d';
}

function parseSort(value: string | null): SortField {
  return (VALID_SORTS as readonly string[]).includes(value ?? '')
    ? (value as SortField)
    : 'trending_score';
}

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

// Response is identical for all visitors (public data, anon Supabase key, no
// auth/cookies), so let Netlify's CDN cache it. Browser cache is kept short so
// clients pick up fresh data quickly; the CDN serves warm hits for 5 minutes
// and stale-while-revalidate for up to an hour.
const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60',
  'Netlify-CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
};

// Errors must never be cached by the CDN or the browser.
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  try {
    // Set CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json',
    };

    // Handle preflight OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers,
        body: '',
      };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: { ...headers, ...NO_STORE_HEADERS },
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    // Parse query parameters, coercing everything to bounded/known values so
    // junk params can't fragment the CDN cache or reach the database.
    const params = new URLSearchParams(event.rawQuery || '');
    const query: TrendingQuery = {
      period: parsePeriod(params.get('period')),
      limit: parseBoundedInt(params.get('limit'), 50, 1, 100),
      language: params.get('language') || undefined,
      minStars: parseBoundedInt(params.get('minStars'), 0, 0, 1_000_000),
      sort: parseSort(params.get('sort')),
    };

    // Convert period to interval
    const intervalMap = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };

    console.log('Fetching trending repositories with params:', query);

    // Call the trending repositories function with fallback
    // This will return top repos by stars if no recent metrics data exists
    const { data: trendingRepos, error } = await getSupabase().rpc(
      'get_trending_repositories_with_fallback',
      {
        p_time_period: intervalMap[query.period],
        p_limit: query.limit,
        p_language: query.language,
        p_min_stars: query.minStars,
      }
    );

    if (error) {
      console.error('Error fetching trending repositories:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        query,
      });

      return {
        statusCode: 500,
        headers: { ...headers, ...NO_STORE_HEADERS },
        body: JSON.stringify({
          error: 'Failed to fetch trending repositories',
          details: error.message,
        }),
      };
    }

    // Sort results if requested (the SQL function returns by trending_score by default)
    let sortedRepos: TrendingRepoRow[] = trendingRepos || [];

    if (query.sort !== 'trending_score' && sortedRepos.length > 0) {
      sortedRepos = [...sortedRepos].sort(
        (a, b) => toNumber(b[query.sort]) - toNumber(a[query.sort])
      );
    }

    // Get trending statistics for metadata
    const { data: stats } = await getSupabase().rpc('get_trending_statistics', {
      p_time_period: intervalMap[query.period],
    });

    const response = {
      repositories: sortedRepos.map((repo) => ({
        id: repo.repository_id,
        owner: repo.owner,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        trending_score: toNumber(repo.trending_score),
        star_change: toNumber(repo.star_change),
        pr_change: toNumber(repo.pr_change),
        contributor_change: toNumber(repo.contributor_change),
        last_activity: repo.last_activity,
        avatar_url: repo.avatar_url,
        html_url: repo.html_url,
      })),
      metadata: {
        period: query.period,
        limit: query.limit,
        language: query.language,
        minStars: query.minStars,
        sort: query.sort,
        totalCount: sortedRepos.length,
        statistics: stats?.[0] || null,
      },
      generated_at: new Date().toISOString(),
    };

    console.log('Returning %d trending repositories', response.repositories.length);

    return {
      statusCode: 200,
      headers: { ...headers, ...CACHE_HEADERS },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error in trending repositories API:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        ...NO_STORE_HEADERS,
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
