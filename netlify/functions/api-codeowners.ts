import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation.mjs';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter.mjs';

interface CodeOwnersResponse {
  content?: string;
  exists: boolean;
  path?: string;
  error?: string;
}

async function fetchCodeOwnersFromDatabase(
  repositoryId: string,
  supabase: ReturnType<typeof createClient>
): Promise<CodeOwnersResponse> {
  try {
    const { data, error } = await supabase
      .from('codeowners')
      .select('content, file_path, updated_at')
      .eq('repository_id', repositoryId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching CODEOWNERS:', error);
      return { exists: false, error: 'Failed to fetch CODEOWNERS from database' };
    }

    if (!data) {
      return { exists: false, error: 'No CODEOWNERS file found in repository' };
    }

    return { content: data.content, exists: true, path: data.file_path };
  } catch (error) {
    console.error('Error fetching CODEOWNERS from database:', error);
    return { exists: false, error: 'Failed to fetch CODEOWNERS from database' };
  }
}

export default async (req: Request, context: Context) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    return createErrorResponse('Missing Supabase configuration', 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const limiter = new RateLimiter(supabaseUrl, supabaseKey, {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  });

  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }
  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    const rateKey = getRateLimitKey(req);
    const rate = await limiter.checkLimit(rateKey);
    if (!rate.allowed) {
      return applyRateLimitHeaders(createErrorResponse('Rate limit exceeded', 429), rate);
    }

    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    const apiIndex = parts.findIndex((p) => p === 'api');
    if (apiIndex === -1 || parts.length < apiIndex + 5) {
      return createErrorResponse('Invalid API path format');
    }
    const owner = parts[apiIndex + 2];
    const repo = parts[apiIndex + 3];

    const validation = await validateRepository(owner, repo, supabase);
    if (!validation.isTracked) {
      return createNotFoundResponse(owner, repo, validation.trackingUrl);
    }
    if (validation.error) {
      return createErrorResponse(validation.error);
    }

    const { data: repository, error: repoError } = await supabase
      .from('tracked_repositories')
      .select('id')
      .eq('owner', owner.toLowerCase())
      .eq('name', repo.toLowerCase())
      .maybeSingle();
    if (repoError || !repository) {
      return createNotFoundResponse(owner, repo);
    }

    const codeOwnersData = await fetchCodeOwnersFromDatabase(repository.id, supabase);
    if (!codeOwnersData.exists) {
      const resp = new Response(
        JSON.stringify({
          exists: false,
          message: codeOwnersData.error || 'No CODEOWNERS file found in repository',
          checkedPaths: ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS'],
        }),
        {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
        }
      );
      return applyRateLimitHeaders(resp, rate);
    }

    const resp = new Response(
      JSON.stringify({
        exists: true,
        content: codeOwnersData.content,
        path: codeOwnersData.path,
        repository: `${owner}/${repo}`
      }),
      {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
      }
    );
    return applyRateLimitHeaders(resp, rate);
  } catch (error) {
    console.error('Error in api-codeowners:', error);
    return createErrorResponse(
      `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/codeowners',
};