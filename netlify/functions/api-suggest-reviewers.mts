import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation.ts';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter.mts';

interface ReviewerSuggestion {
  handle: string;
  reason: string;
  confidence: number;
  signals: string[];
  metadata?: {
    avatarUrl?: string;
    reviewCount?: number;
    lastReviewDate?: string;
    score: number;
  };
}

interface PullRequestFiles {
  files: string[];
  directories: Set<string>;
  fileTypes: Set<string>;
}

async function analyzePRFiles(files: string[]): Promise<PullRequestFiles> {
  const directories = new Set<string>();
  const fileTypes = new Set<string>();

  for (const file of files) {
    // Extract directories
    const lastSlash = file.lastIndexOf('/');
    if (lastSlash > 0) {
      const dir = file.substring(0, lastSlash);
      const parts = dir.split('/');
      for (let i = 1; i <= parts.length; i++) {
        directories.add(parts.slice(0, i).join('/'));
      }
    }

    // Extract file types
    const lastDot = file.lastIndexOf('.');
    if (lastDot > 0 && lastDot < file.length - 1) {
      fileTypes.add(file.substring(lastDot + 1));
    }
  }

  return { files, directories, fileTypes };
}

async function getReviewerSuggestionsFromHistory(
  repositoryId: string,
  prFiles: PullRequestFiles,
  prAuthor: string | undefined,
  supabase: ReturnType<typeof createClient>
): Promise<ReviewerSuggestion[]> {
  const suggestions: ReviewerSuggestion[] = [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Get review history for this repository
  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .select(`
      id,
      state,
      submitted_at,
      pull_request_id,
      reviewer:contributors!reviewer_id(username, avatar_url),
      pull_request:pull_requests!inner(
        id,
        title,
        changed_files,
        additions,
        deletions,
        merged_at
      )
    `)
    .eq('pull_request.repository_id', repositoryId)
    .gte('submitted_at', ninetyDaysAgo)
    .order('submitted_at', { ascending: false })
    .limit(500);

  if (reviewError) {
    console.error('Failed to fetch review data:', reviewError);
    throw new Error(`Failed to fetch review data: ${reviewError.message}`);
  }

  // Analyze review patterns
  const reviewerStats = new Map<string, {
    username: string;
    avatarUrl?: string;
    totalReviews: number;
    approvedReviews: number;
    lastReviewDate: Date;
    reviewedAreas: Set<string>;
  }>();

  for (const review of reviewData || []) {
    const username = review.reviewer?.username;
    if (!username || username === prAuthor) continue;

    const stats = reviewerStats.get(username) || {
      username,
      avatarUrl: review.reviewer?.avatar_url,
      totalReviews: 0,
      approvedReviews: 0,
      lastReviewDate: new Date(0),
      reviewedAreas: new Set<string>(),
    };

    stats.totalReviews++;
    if (review.state === 'APPROVED') stats.approvedReviews++;

    const reviewDate = new Date(review.submitted_at);
    if (reviewDate > stats.lastReviewDate) {
      stats.lastReviewDate = reviewDate;
    }

    // Analyze PR title for expertise areas
    const prTitle = review.pull_request?.title || '';
    const titleLower = prTitle.toLowerCase();

    // Extract expertise areas from PR titles
    if (titleLower.includes('auth') || titleLower.includes('login')) stats.reviewedAreas.add('authentication');
    if (titleLower.includes('api') || titleLower.includes('endpoint')) stats.reviewedAreas.add('API');
    if (titleLower.includes('ui') || titleLower.includes('frontend') || titleLower.includes('component')) stats.reviewedAreas.add('frontend');
    if (titleLower.includes('test') || titleLower.includes('spec')) stats.reviewedAreas.add('testing');
    if (titleLower.includes('docs') || titleLower.includes('readme')) stats.reviewedAreas.add('documentation');
    if (titleLower.includes('database') || titleLower.includes('db') || titleLower.includes('migration')) stats.reviewedAreas.add('database');
    if (titleLower.includes('deploy') || titleLower.includes('ci') || titleLower.includes('cd')) stats.reviewedAreas.add('DevOps');
    if (titleLower.includes('perf') || titleLower.includes('optim')) stats.reviewedAreas.add('performance');
    if (titleLower.includes('fix') || titleLower.includes('bug')) stats.reviewedAreas.add('bug fixes');
    if (titleLower.includes('refactor')) stats.reviewedAreas.add('refactoring');

    // Analyze file types if available
    for (const fileType of prFiles.fileTypes) {
      if (fileType === 'ts' || fileType === 'tsx' || fileType === 'js' || fileType === 'jsx') {
        stats.reviewedAreas.add('TypeScript/JavaScript');
      } else if (fileType === 'css' || fileType === 'scss' || fileType === 'sass') {
        stats.reviewedAreas.add('styling');
      } else if (fileType === 'sql') {
        stats.reviewedAreas.add('database');
      } else if (fileType === 'md' || fileType === 'mdx') {
        stats.reviewedAreas.add('documentation');
      }
    }

    reviewerStats.set(username, stats);
  }

  // Score and format each reviewer
  for (const stats of reviewerStats.values()) {
    let score = 0;
    const signals: string[] = [];

    // Base score from review frequency
    score += Math.min(stats.totalReviews * 3, 30);

    if (stats.totalReviews >= 10) {
      signals.push('frequent_reviewer');
    } else if (stats.totalReviews >= 5) {
      signals.push('active_reviewer');
    } else if (stats.totalReviews >= 1) {
      signals.push('past_reviewer');
    }

    // Boost for recent activity
    const daysSinceLastReview = (Date.now() - stats.lastReviewDate.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceLastReview < 7) {
      score += 15;
      signals.push('recently_active');
    } else if (daysSinceLastReview < 14) {
      score += 10;
      signals.push('active_this_month');
    } else if (daysSinceLastReview < 30) {
      score += 5;
    }

    // Quality signal from approval behavior
    if (stats.totalReviews > 0) {
      const approvalRate = stats.approvedReviews / stats.totalReviews;
      if (approvalRate > 0.3 && approvalRate < 0.9) {
        score += 5;
        signals.push('balanced_reviewer');
      }
    }

    // Generate natural language reason
    let reason = '';
    const areas = Array.from(stats.reviewedAreas).slice(0, 3);
    const areaString = areas.length > 0 ? ` with expertise in ${areas.join(', ')}` : '';

    if (stats.totalReviews >= 10 && daysSinceLastReview < 7) {
      reason = `${stats.username} frequently reviews PRs (${stats.totalReviews} in the last 90 days) and was active this week${areaString}`;
    } else if (stats.totalReviews >= 5 && daysSinceLastReview < 14) {
      reason = `${stats.username} regularly reviews PRs (${stats.totalReviews} recent reviews) and remains active${areaString}`;
    } else if (daysSinceLastReview < 7) {
      reason = `${stats.username} recently reviewed PRs and is currently active in the repository${areaString}`;
    } else if (stats.totalReviews >= 3) {
      const timeAgo = daysSinceLastReview < 30 ? 'in the past month' : 'previously';
      reason = `${stats.username} has reviewed ${stats.totalReviews} PRs ${timeAgo}${areaString}`;
    } else {
      reason = `${stats.username} has experience reviewing PRs in this repository${areaString}`;
    }

    // Calculate confidence
    const confidence = Math.min(
      0.3 +
      (stats.totalReviews / 20) * 0.3 +
      (daysSinceLastReview < 14 ? 0.2 : 0) +
      (signals.length * 0.05) +
      (areas.length * 0.05),
      0.95
    );

    suggestions.push({
      handle: stats.username,
      reason,
      confidence,
      signals,
      metadata: {
        avatarUrl: stats.avatarUrl,
        reviewCount: stats.totalReviews,
        lastReviewDate: stats.lastReviewDate.toISOString(),
        score,
      },
    });
  }

  // Sort by score
  suggestions.sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0));

  return suggestions;
}

function parseCodeOwners(content: string, prFiles: PullRequestFiles): Set<string> {
  const owners = new Set<string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    const pattern = parts[0];
    const fileOwners = parts.slice(1).filter((o) => o.startsWith('@'));

    let matches = false;
    for (const f of prFiles.files) {
      if (pattern.endsWith('/')) {
        if (f.startsWith(pattern.replace(/^\//, ''))) {
          matches = true;
          break;
        }
      } else if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/^\//, '').replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        if (regex.test(f)) {
          matches = true;
          break;
        }
      } else {
        if (f === pattern.replace(/^\//, '')) {
          matches = true;
          break;
        }
      }
    }

    if (matches) {
      fileOwners.forEach((o) => owners.add(o.substring(1)));
    }
  }

  return owners;
}

export default async (req: Request, context: Context) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration');
    console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    return createErrorResponse('Missing Supabase configuration', 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const limiter = new RateLimiter(supabaseUrl, supabaseKey, {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  });

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS_HEADERS });
  if (req.method !== 'POST') return createErrorResponse('Method not allowed', 405);

  try {
    const rateKey = getRateLimitKey(req);
    const rate = await limiter.checkLimit(rateKey);
    if (!rate.allowed) return applyRateLimitHeaders(createErrorResponse('Rate limit exceeded', 429), rate);

    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    const apiIndex = parts.findIndex((p) => p === 'api');
    if (apiIndex === -1 || parts.length < apiIndex + 5) return createErrorResponse('Invalid API path format');

    let owner = parts[apiIndex + 2];
    let repo = parts[apiIndex + 3];

    console.log(`Validating repository: ${owner}/${repo}`);
    const validation = await validateRepository(owner, repo);
    if (validation.error) {
      console.error('Validation error:', validation.error);
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
    if (!validation.isTracked) return createNotFoundResponse(owner, repo, validation.trackingUrl);

    const body = await req.json();
    let { files, prAuthor, prUrl } = body || {};

    // If PR URL is provided, fetch files from GitHub
    if (typeof prUrl === 'string' && prUrl.includes('github.com')) {
      const m = prUrl.match(/github\.com\/(.*?)\/(.*?)\/pull\/(\d+)/i);
      if (m) {
        owner = m[1];
        repo = m[2];
        const prNumber = parseInt(m[3], 10);

        // Try multiple token sources for better auth coverage
        const ghToken = process.env.GITHUB_TOKEN ||
                       process.env.VITE_GITHUB_TOKEN ||
                       process.env.GH_TOKEN ||
                       process.env.SUPABASE_SERVICE_KEY || // Sometimes used as fallback
                       '';

        const headers: HeadersInit = {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        };

        if (ghToken && ghToken.length > 10) {
          headers['Authorization'] = `Bearer ${ghToken}`;
        }

        console.log(`Attempting to fetch files for PR: ${prUrl}`);

        // Fetch PR files (paginated)
        const collected: string[] = [];
        for (let page = 1; page <= 3; page++) {
          const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
            { headers }
          );
          if (!r.ok) {
            const errorBody = await r.text();
            console.error(`Failed to fetch PR files: ${r.status} ${r.statusText}. Body: ${errorBody}`);

            // Try without auth if 401
            if (r.status === 401 && ghToken) {
              console.log('Retrying without auth token...');
              const publicHeaders: HeadersInit = { Accept: 'application/vnd.github+json' };
              const publicResp = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
                { headers: publicHeaders }
              );

              if (publicResp.ok) {
                const arr = await publicResp.json();
                const pageFiles = Array.isArray(arr) ? arr.map((f: any) => f.filename).filter(Boolean) : [];
                collected.push(...pageFiles);
                if (pageFiles.length < 100) break;
                continue;
              }
            }

            if (page === 1 && collected.length === 0) {
              // Only fail if we couldn't get any files
              console.warn(`Could not fetch PR files from GitHub (${r.status}). Will proceed without file analysis.`);
              // Don't return error - continue with empty files array
            }
            break;
          }
          const arr = await r.json();
          const pageFiles = Array.isArray(arr) ? arr.map((f: any) => f.filename).filter(Boolean) : [];
          collected.push(...pageFiles);
          if (pageFiles.length < 100) break;
        }
        if (collected.length > 0) {
          files = collected;
        }
      }
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      if (prUrl) {
        return createErrorResponse(
          'Failed to fetch files from the provided PR URL. The URL may be invalid, the repository may be private, or the GitHub API may be inaccessible.',
          400
        );
      }
      return createErrorResponse('Please provide an array of files changed in the PR', 400);
    }

    const prFiles = await analyzePRFiles(files);

    // Get repository ID
    const { data: repository, error: repoError } = await supabase
      .from('tracked_repositories')
      .select('id')
      .eq('organization_name', owner.toLowerCase())
      .eq('repository_name', repo.toLowerCase())
      .maybeSingle();

    if (repoError) {
      console.error('Database error:', repoError);
      return createErrorResponse(`Database error: ${repoError.message}`, 500);
    }

    if (!repository) {
      return createNotFoundResponse(owner, repo);
    }

    // Get reviewer suggestions from history
    let suggestions = await getReviewerSuggestionsFromHistory(repository.id, prFiles, prAuthor, supabase);

    // Add CODEOWNERS if available
    let codeOwners: string[] = [];
    const { data: coData } = await supabase
      .from('codeowners')
      .select('content')
      .eq('repository_id', repository.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (coData?.content) {
      const codeOwnerSet = parseCodeOwners(coData.content, prFiles);
      codeOwners = Array.from(codeOwnerSet);

      // Add code owners to suggestions with high priority
      for (const codeOwner of codeOwners) {
        const existingIndex = suggestions.findIndex(s => s.handle === codeOwner);
        if (existingIndex >= 0) {
          // Boost existing reviewer who is also a code owner
          suggestions[existingIndex].signals.unshift('code_owner');
          suggestions[existingIndex].reason = `${codeOwner} is a code owner and ${suggestions[existingIndex].reason}`;
          suggestions[existingIndex].confidence = Math.min(suggestions[existingIndex].confidence + 0.2, 0.99);
          if (suggestions[existingIndex].metadata) {
            suggestions[existingIndex].metadata!.score += 25;
          }
        } else {
          // Add new code owner
          suggestions.unshift({
            handle: codeOwner,
            reason: `${codeOwner} is listed as a code owner for the modified files`,
            confidence: 0.9,
            signals: ['code_owner'],
            metadata: {
              score: 25,
            },
          });
        }
      }
    }

    // Re-sort after adding code owners
    suggestions.sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0));

    // Take top suggestions
    const topSuggestions = suggestions.slice(0, 10);

    const resp = new Response(
      JSON.stringify({
        suggestions: topSuggestions,
        codeOwners,
        repository: `${owner}/${repo}`,
        filesAnalyzed: files.length,
        directoriesAffected: prFiles.directories.size,
        generatedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );

    return applyRateLimitHeaders(resp, rate);
  } catch (error) {
    console.error('Error in api-suggest-reviewers:', error);
    return createErrorResponse(`Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/suggest-reviewers',
};