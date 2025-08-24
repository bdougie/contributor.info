import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface TrendingQuery {
  period?: '24h' | '7d' | '30d';
  limit?: number;
  language?: string;
  minStars?: number;
  sort?: 'trending_score' | 'star_change' | 'pr_change' | 'contributor_change';
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
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
        headers,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    // Parse query parameters
    const params = new URLSearchParams(event.queryStringParameters || {});
    const query: TrendingQuery = {
      period: (params.get('period') as '24h' | '7d' | '30d') || '7d',
      limit: Math.min(parseInt(params.get('limit') || '50'), 100), // Cap at 100
      language: params.get('language') || undefined,
      minStars: parseInt(params.get('minStars') || '0'),
      sort: (params.get('sort') as any) || 'trending_score',
    };

    // Convert period to interval
    const intervalMap = {
      '24h': '24 hours',
      '7d': '7 days',
      '30d': '30 days',
    };

    console.log('Fetching trending repositories with params:', query);

    // Call the trending repositories function
    const { data: trendingRepos, error } = await supabase.rpc('get_trending_repositories', {
      p_time_period: intervalMap[query.period],
      p_limit: query.limit,
      p_language: query.language,
      p_min_stars: query.minStars,
    });

    if (error) {
      console.error('Error fetching trending repositories:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to fetch trending repositories',
          details: error.message,
        }),
      };
    }

    // Sort results if requested (the SQL function returns by trending_score by default)
    let sortedRepos = trendingRepos || [];
    
    if (query.sort !== 'trending_score' && sortedRepos.length > 0) {
      sortedRepos = [...sortedRepos].sort((a, b) => {
        const aValue = a[query.sort!] || 0;
        const bValue = b[query.sort!] || 0;
        return bValue - aValue;
      });
    }

    // Get trending statistics for metadata
    const { data: stats } = await supabase.rpc('get_trending_statistics', {
      p_time_period: intervalMap[query.period],
    });

    const response = {
      repositories: sortedRepos.map(repo => ({
        id: repo.repository_id,
        owner: repo.owner,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        trending_score: parseFloat(repo.trending_score || '0'),
        star_change: parseFloat(repo.star_change || '0'),
        pr_change: parseFloat(repo.pr_change || '0'),
        contributor_change: parseFloat(repo.contributor_change || '0'),
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

    console.log(`Returning ${response.repositories.length} trending repositories`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error in trending repositories API:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};