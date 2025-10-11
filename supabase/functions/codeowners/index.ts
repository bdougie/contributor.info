import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Rate limiting configuration
const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

function getRateLimitKey(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  identifier: string
): Promise<RateLimitResult> {
  const key = `rate_limit:codeowners:${identifier}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  try {
    const { data: rateLimitData, error: fetchError } = await supabase
      .from('rate_limits')
      .select('request_count, window_start, last_request')
      .eq('key', key)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Rate limit check error:', fetchError);
      return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS,
        resetTime: now + RATE_LIMIT_WINDOW_MS,
      };
    }

    let requestCount = 0;
    let currentWindowStart = now;

    if (rateLimitData) {
      const dataWindowStart = new Date(rateLimitData.window_start).getTime();

      if (dataWindowStart > windowStart) {
        requestCount = rateLimitData.request_count;
        currentWindowStart = dataWindowStart;
      } else {
        currentWindowStart = now;
      }
    }

    if (requestCount >= RATE_LIMIT_MAX_REQUESTS) {
      const resetTime = currentWindowStart + RATE_LIMIT_WINDOW_MS;
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }

    requestCount++;

    await supabase.from('rate_limits').upsert(
      {
        key,
        request_count: requestCount,
        window_start: new Date(currentWindowStart).toISOString(),
        last_request: new Date(now).toISOString(),
      },
      { onConflict: 'key' }
    );

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS - requestCount,
      resetTime: currentWindowStart + RATE_LIMIT_WINDOW_MS,
    };
  } catch (error) {
    console.error('Rate limiter error:', error);
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_REQUESTS,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    };
  }
}

function applyRateLimitHeaders(headers: Headers, rateLimitResult: RateLimitResult): void {
  headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX_REQUESTS));
  headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  headers.set('X-RateLimit-Reset', String(Math.floor(rateLimitResult.resetTime / 1000)));

  if (!rateLimitResult.allowed && rateLimitResult.retryAfter) {
    headers.set('Retry-After', String(rateLimitResult.retryAfter));
  }
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
      console.error('Database error fetching CODEOWNERS: %s', error.message);
      return { exists: false, error: 'Failed to fetch CODEOWNERS from database' };
    }

    if (!data) {
      return { exists: false, error: 'No CODEOWNERS file found in repository' };
    }

    return { content: data.content, exists: true, path: data.file_path };
  } catch (error) {
    console.error('Error fetching CODEOWNERS from database: %s', error instanceof Error ? error.message : 'Unknown');
    return { exists: false, error: 'Failed to fetch CODEOWNERS from database' };
  }
}

function createErrorResponse(error: string, status = 400): Response {
  return new Response(JSON.stringify({ error, success: false }), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

function createNotFoundResponse(owner: string, repo: string, trackingUrl?: string): Response {
  return new Response(
    JSON.stringify({
      error: 'Repository not found',
      message: `Repository ${owner}/${repo} is not being tracked`,
      trackingUrl: trackingUrl || `https://contributor.info/${owner}/${repo}`,
      action: 'Please visit the tracking URL to start tracking this repository',
    }),
    {
      status: 404,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
      },
    }
  );
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      return createErrorResponse('Missing Supabase configuration', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check rate limit
    const rateKey = getRateLimitKey(req);
    const rate = await checkRateLimit(supabase, rateKey);

    if (!rate.allowed) {
      const headers = new Headers(CORS_HEADERS);
      headers.set('Content-Type', 'application/json');
      applyRateLimitHeaders(headers, rate);
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers,
      });
    }

    // Parse path to get owner and repo
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Expected path: /repos/:owner/:repo/codeowners
    if (pathParts.length < 4 || pathParts[0] !== 'repos' || pathParts[3] !== 'codeowners') {
      return createErrorResponse('Invalid API path format. Expected: /repos/:owner/:repo/codeowners');
    }

    const owner = pathParts[1];
    const repo = pathParts[2];

    if (!owner || !repo) {
      return createErrorResponse('Missing owner or repo parameter');
    }

    // Validate repository format
    const isValidRepoName = (name: string): boolean => /^[a-zA-Z0-9._-]+$/.test(name);

    if (!isValidRepoName(owner) || !isValidRepoName(repo)) {
      return createErrorResponse(
        'Invalid repository format. Names can only contain letters, numbers, dots, underscores, and hyphens'
      );
    }

    if (owner.length > 39 || repo.length > 100) {
      return createErrorResponse('Repository or organization name is too long');
    }

    // Check if repository is tracked
    const { data: repository, error: repoError } = await supabase
      .from('tracked_repositories')
      .select('id, tracking_enabled')
      .eq('organization_name', owner.toLowerCase())
      .eq('repository_name', repo.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (repoError) {
      return createErrorResponse(
        `Database error while fetching repository: ${repoError.message}`,
        500
      );
    }

    if (!repository) {
      return createNotFoundResponse(owner, repo);
    }

    if (!repository.tracking_enabled) {
      const trackingUrl = `https://contributor.info/${owner}/${repo}`;
      return createNotFoundResponse(owner, repo, trackingUrl);
    }

    // First check database
    let codeOwnersData = await fetchCodeOwnersFromDatabase(repository.id, supabase);

    // If not in database or force refresh requested, fetch from GitHub
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    if (!codeOwnersData.exists || forceRefresh) {
      const ghToken = Deno.env.get('GITHUB_TOKEN') ?? '';
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
              // Decode base64 content
              foundContent = atob(data.content.replace(/\s/g, ''));
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
                console.error('Failed to save CODEOWNERS to database: %s', insertError.message);
              } else {
                console.log('Saved CODEOWNERS for %s/%s to database', owner, repo);
              }

              break;
            }
          }
        } catch (e) {
          // Continue to next path
          console.error('Error fetching CODEOWNERS from path %s: %s', path, e instanceof Error ? e.message : 'Unknown');
        }
      }

      if (foundContent && foundPath) {
        codeOwnersData = { exists: true, content: foundContent, path: foundPath };
      } else if (!codeOwnersData.exists) {
        // Return 200 with structured empty state instead of 404
        const responseHeaders = new Headers(CORS_HEADERS);
        responseHeaders.set('Content-Type', 'application/json');
        responseHeaders.set('Cache-Control', 'public, max-age=300');
        applyRateLimitHeaders(responseHeaders, rate);

        return new Response(
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
            headers: responseHeaders,
          }
        );
      }
    }

    // Return successful response
    const responseHeaders = new Headers(CORS_HEADERS);
    responseHeaders.set('Content-Type', 'application/json');
    responseHeaders.set('Cache-Control', 'public, max-age=300');
    applyRateLimitHeaders(responseHeaders, rate);

    return new Response(
      JSON.stringify({
        exists: true,
        content: codeOwnersData.content,
        path: codeOwnersData.path,
        repository: `${owner}/${repo}`,
      }),
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error('Error in codeowners function: %s', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(
      `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
});
