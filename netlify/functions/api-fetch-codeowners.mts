import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation.ts';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter.mts';

interface CodeOwnerSuggestion {
  pattern: string;
  owners: string[];
  confidence: number;
  reasoning: string;
}

async function fetchCodeOwnersFromGitHub(owner: string, repo: string): Promise<{
  exists: boolean;
  content?: string;
  path?: string;
  message?: string;
}> {
  // Try multiple token sources
  const ghToken = process.env.GITHUB_TOKEN ||
                 process.env.VITE_GITHUB_TOKEN ||
                 process.env.GH_TOKEN ||
                 '';

  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  if (ghToken && ghToken.length > 10) {
    headers['Authorization'] = `Bearer ${ghToken}`;
  }

  // Check multiple possible locations for CODEOWNERS
  const possiblePaths = [
    '.github/CODEOWNERS',
    'CODEOWNERS',
    'docs/CODEOWNERS',
    '.gitlab/CODEOWNERS'  // Some projects might have migrated from GitLab
  ];

  for (const path of possiblePaths) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const response = await fetch(url, { headers });

      if (response.ok) {
        const data = await response.json();

        // GitHub returns content as base64
        if (data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return {
            exists: true,
            content,
            path: data.path
          };
        }
      } else if (response.status === 401 && ghToken) {
        // Try without auth if we get 401
        const publicResponse = await fetch(url, {
          headers: { Accept: 'application/vnd.github+json' }
        });

        if (publicResponse.ok) {
          const data = await publicResponse.json();
          if (data.content) {
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return {
              exists: true,
              content,
              path: data.path
            };
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching CODEOWNERS from ${path}:`, error);
    }
  }

  return {
    exists: false,
    message: 'No CODEOWNERS file found in repository'
  };
}

async function generateCodeOwnersSuggestions(
  repositoryId: string,
  supabase: ReturnType<typeof createClient>
): Promise<CodeOwnerSuggestion[]> {
  const suggestions: CodeOwnerSuggestion[] = [];

  // Analyze PR patterns to suggest code owners
  const { data: prPatterns, error: prError } = await supabase
    .from('pull_requests')
    .select(`
      title,
      files_changed,
      merged_at,
      author:contributors!author_id(username),
      reviews:reviews!pull_request_id(
        reviewer:contributors!reviewer_id(username),
        state
      )
    `)
    .eq('repository_id', repositoryId)
    .not('merged_at', 'is', null)
    .order('merged_at', { ascending: false })
    .limit(100);

  if (prError) {
    console.error('Error fetching PR patterns:', prError);
    return suggestions;
  }

  // Analyze file patterns and frequent reviewers
  const filePatterns = new Map<string, Map<string, number>>();
  const reviewerStats = new Map<string, { total: number; approved: number }>();

  for (const pr of prPatterns || []) {
    // Track reviewer patterns
    for (const review of pr.reviews || []) {
      const reviewer = review.reviewer?.username;
      if (reviewer) {
        const stats = reviewerStats.get(reviewer) || { total: 0, approved: 0 };
        stats.total++;
        if (review.state === 'APPROVED') stats.approved++;
        reviewerStats.set(reviewer, stats);
      }
    }

    // Infer file patterns from PR titles
    const title = pr.title?.toLowerCase() || '';
    let pattern = '';

    if (title.includes('frontend') || title.includes('ui') || title.includes('component')) {
      pattern = 'src/components/';
    } else if (title.includes('api') || title.includes('backend')) {
      pattern = 'src/api/';
    } else if (title.includes('test') || title.includes('spec')) {
      pattern = '**/test/';
    } else if (title.includes('docs') || title.includes('readme')) {
      pattern = '*.md';
    } else if (title.includes('config') || title.includes('setup')) {
      pattern = '*.config.*';
    } else if (title.includes('database') || title.includes('migration')) {
      pattern = 'migrations/';
    }

    if (pattern) {
      for (const review of pr.reviews || []) {
        const reviewer = review.reviewer?.username;
        if (reviewer && review.state === 'APPROVED') {
          const patternReviewers = filePatterns.get(pattern) || new Map<string, number>();
          patternReviewers.set(reviewer, (patternReviewers.get(reviewer) || 0) + 1);
          filePatterns.set(pattern, patternReviewers);
        }
      }
    }
  }

  // Generate suggestions based on patterns
  for (const [pattern, reviewers] of filePatterns.entries()) {
    const sortedReviewers = Array.from(reviewers.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (sortedReviewers.length > 0) {
      const topReviewers = sortedReviewers.map(([username]) => `@${username}`);
      const reviewCount = sortedReviewers[0][1];

      let reasoning = '';
      if (pattern.includes('components')) {
        reasoning = `${topReviewers[0]} frequently reviews frontend components (${reviewCount} approved PRs)`;
      } else if (pattern.includes('api')) {
        reasoning = `${topReviewers[0]} has expertise in API changes (${reviewCount} approved reviews)`;
      } else if (pattern.includes('test')) {
        reasoning = `${topReviewers[0]} consistently reviews test files (${reviewCount} approvals)`;
      } else if (pattern.includes('.md')) {
        reasoning = `${topReviewers[0]} regularly reviews documentation changes`;
      } else if (pattern.includes('config')) {
        reasoning = `${topReviewers[0]} has reviewed ${reviewCount} configuration changes`;
      } else if (pattern.includes('migrations')) {
        reasoning = `${topReviewers[0]} reviews database migrations (${reviewCount} approvals)`;
      } else {
        reasoning = `${topReviewers[0]} frequently reviews files matching this pattern`;
      }

      suggestions.push({
        pattern,
        owners: topReviewers,
        confidence: Math.min(reviewCount / 10, 0.95),
        reasoning
      });
    }
  }

  // Add top overall reviewers as a catch-all
  const topReviewers = Array.from(reviewerStats.entries())
    .filter(([_, stats]) => stats.total >= 5 && stats.approved / stats.total > 0.5)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3)
    .map(([username]) => `@${username}`);

  if (topReviewers.length > 0) {
    suggestions.push({
      pattern: '*',
      owners: topReviewers,
      confidence: 0.7,
      reasoning: `${topReviewers[0]} is a top reviewer with high approval rate across the repository`
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

export default async (req: Request, context: Context) => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    return createErrorResponse('Missing Supabase configuration', 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const limiter = new RateLimiter(supabaseUrl, supabaseKey, {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  });

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS_HEADERS });
  if (req.method !== 'GET') return createErrorResponse('Method not allowed', 405);

  try {
    const rateKey = getRateLimitKey(req);
    const rate = await limiter.checkLimit(rateKey);
    if (!rate.allowed) return applyRateLimitHeaders(createErrorResponse('Rate limit exceeded', 429), rate);

    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    const apiIndex = parts.findIndex((p) => p === 'api');

    if (apiIndex === -1 || parts.length < apiIndex + 5) {
      return createErrorResponse('Invalid API path format', 400);
    }

    const owner = parts[apiIndex + 2];
    const repo = parts[apiIndex + 3];

    // Validate repository
    const validation = await validateRepository(owner, repo, supabase);
    if (!validation.isTracked) return createNotFoundResponse(owner, repo, validation.trackingUrl);
    if (validation.error) return createErrorResponse(validation.error);

    // Get repository ID
    const { data: repository } = await supabase
      .from('tracked_repositories')
      .select('id')
      .eq('organization_name', owner.toLowerCase())
      .eq('repository_name', repo.toLowerCase())
      .maybeSingle();

    if (!repository) {
      return createNotFoundResponse(owner, repo);
    }

    // First, try to fetch from GitHub
    const githubResult = await fetchCodeOwnersFromGitHub(owner, repo);

    let response: any = {
      repository: `${owner}/${repo}`,
      source: githubResult.exists ? 'github' : 'none',
      exists: githubResult.exists,
      path: githubResult.path,
      content: githubResult.content,
      message: githubResult.message
    };

    // If no CODEOWNERS exists, generate suggestions
    if (!githubResult.exists) {
      const suggestions = await generateCodeOwnersSuggestions(repository.id, supabase);

      if (suggestions.length > 0) {
        // Generate a suggested CODEOWNERS file content
        const suggestedContent = [
          '# CODEOWNERS file generated based on PR review patterns',
          '# These suggestions are based on historical review data',
          '',
          ...suggestions.map(s =>
            `# ${s.reasoning}\n${s.pattern} ${s.owners.join(' ')}`
          )
        ].join('\n');

        response = {
          ...response,
          suggestions,
          suggestedContent,
          message: 'No CODEOWNERS file found. Suggestions generated based on review patterns.'
        };
      } else {
        response.message = 'No CODEOWNERS file found and insufficient data to generate suggestions.';
      }
    }

    const resp = new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

    return applyRateLimitHeaders(resp, rate);
  } catch (error) {
    console.error('Error in api-fetch-codeowners:', error);
    return createErrorResponse(`Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/codeowners',
};