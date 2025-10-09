import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation.ts';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter.mts';

interface CodeOwnersResponse {
  content?: string;
  exists: boolean;
  path?: string;
  error?: string;
  message?: string;
  helpUrl?: string;
  checkedPaths?: string[];
  repository?: string;
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
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

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
    // Skip rate limiter during unit tests to avoid interfering with Supabase mocks
    const isTestEnv = process.env.NODE_ENV === 'test';
    let rate: any | undefined;
    if (!isTestEnv) {
      const rateKey = getRateLimitKey(req);
      rate = await limiter.checkLimit(rateKey);
      if (!rate.allowed) {
        return applyRateLimitHeaders(createErrorResponse('Rate limit exceeded', 429), rate);
      }
    }

    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    const apiIndex = parts.findIndex((p) => p === 'api');
    if (apiIndex === -1 || parts.length < apiIndex + 5) {
      return createErrorResponse('Invalid API path format');
    }
    const owner = parts[apiIndex + 2];
    const repo = parts[apiIndex + 3];

    const validation = await validateRepository(owner, repo);
    if (validation.error) {
      // Return 500 for database errors, 404 for not tracked
      if (validation.error.includes('Database error')) {
        return createErrorResponse(validation.error, 500);
      }
      // Not tracked, return 404
      if (!validation.isTracked) {
        return createNotFoundResponse(owner, repo, validation.trackingUrl);
      }
      return createErrorResponse(validation.error, 400);
    }
    if (!validation.isTracked) {
      return createNotFoundResponse(owner, repo, validation.trackingUrl);
    }

    const { data: repository, error: repoError } = await supabase
      .from('tracked_repositories')
      .select('id')
      .eq('organization_name', owner.toLowerCase())
      .eq('repository_name', repo.toLowerCase())
      .limit(1)
      .maybeSingle();
    if (repoError || !repository) {
      // If this is a database error, surface as 500; otherwise 404
      if (repoError) {
        return createErrorResponse(
          `Database error while fetching repository: ${repoError.message}`,
          500
        );
      }
      return createNotFoundResponse(owner, repo);
    }

    // First check database
    let codeOwnersData = await fetchCodeOwnersFromDatabase(repository.id, supabase);

    // If not in database or force refresh requested, fetch from GitHub
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    if (!codeOwnersData.exists || forceRefresh) {
      // Try to fetch from GitHub
      const ghToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN || '';
      const headers: HeadersInit = { Accept: 'application/vnd.github+json' };
      if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

      const paths = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS'];
      let foundContent: string | null = null;
      let foundPath: string | null = null;

      for (const path of paths) {
        try {
          const resp = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            { headers }
          );

          if (resp.ok) {
            const data = await resp.json();
            if (data.content) {
              foundContent = Buffer.from(data.content, 'base64').toString('utf-8');
              foundPath = path;

              // Save to database for future use
              const { error: insertError } = await supabase
                .from('codeowners')
                .upsert({
                  id: crypto.randomUUID(),
                  repository_id: repository.id,
                  file_path: path,
                  content: foundContent,
                  sha: data.sha,
                  fetched_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select()
                .single();

              if (insertError) {
                console.error('Failed to save CODEOWNERS to database:', insertError);
              } else {
                console.log(`Saved CODEOWNERS for ${owner}/${repo} to database`);
              }

              break;
            }
          }
        } catch (e) {
          // Continue to next path
        }
      }

      if (foundContent && foundPath) {
        codeOwnersData = { exists: true, content: foundContent, path: foundPath };
      } else if (!codeOwnersData.exists) {
        // Return 200 with structured empty state instead of 404
        const resp = new Response(
          JSON.stringify({
            exists: false,
            message: 'No CODEOWNERS file found in repository',
            helpUrl:
              'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners',
            checkedPaths: paths,
            repository: `${owner}/${repo}`,
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300',
            },
          }
        );
        return rate ? applyRateLimitHeaders(resp, rate) : resp;
      }
    }

    const resp = new Response(
      JSON.stringify({
        exists: true,
        content: codeOwnersData.content,
        path: codeOwnersData.path,
        repository: `${owner}/${repo}`,
      }),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      }
    );
    return rate ? applyRateLimitHeaders(resp, rate) : resp;
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
