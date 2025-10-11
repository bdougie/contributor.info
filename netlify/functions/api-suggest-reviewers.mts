import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation.ts';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter.mts';
import { APIErrorHandler } from './lib/error-handler';
import { generateRequestId, APIResponse } from '../../src/lib/api/error-types';
import { ReviewerCache } from './lib/reviewer-cache.mts';

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

/**
 * Analyzes review history to suggest appropriate reviewers.
 * Returns empty array if:
 * - No recent PRs exist in the last 90 days
 * - No reviews found for recent PRs
 * - All reviewers are the PR author
 *
 * Includes fallback to active contributors if < 3 reviewers found.
 */
async function getReviewerSuggestionsFromHistory(
  repositoryId: string,
  prFiles: PullRequestFiles,
  prAuthor: string | undefined,
  supabase: ReturnType<typeof createClient>
): Promise<ReviewerSuggestion[]> {
  const suggestions: ReviewerSuggestion[] = [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Get recent reviews and their associated PRs
  // This approach finds PRs that have recent review activity, not just recent creation
  const { data: reviewData, error: reviewError } = await supabase
    .from('reviews')
    .select(
      `
      id,
      state,
      submitted_at,
      pull_request_id,
      reviewer:contributors!reviewer_id(username, avatar_url),
      pull_request:pull_requests!inner(
        id,
        title,
        repository_id
      )
    `
    )
    .eq('pull_request.repository_id', repositoryId)
    .gte('submitted_at', ninetyDaysAgo)
    .order('submitted_at', { ascending: false })
    .limit(500);

  if (reviewError) {
    console.error('Failed to fetch review data:', reviewError);
    throw new Error(`Failed to fetch review data: ${reviewError.message}`);
  }

  if (!reviewData || reviewData.length === 0) {
    console.log('No recent reviews found for repository');
    return [];
  }

  // Extract unique PR IDs and build PR data map
  const prMap = new Map<string, { id: string; title: string }>();
  for (const review of reviewData) {
    if (review.pull_request && !prMap.has(review.pull_request.id)) {
      prMap.set(review.pull_request.id, {
        id: review.pull_request.id,
        title: review.pull_request.title || '',
      });
    }
  }

  // Analyze review patterns
  const reviewerStats = new Map<
    string,
    {
      username: string;
      avatarUrl?: string;
      totalReviews: number;
      approvedReviews: number;
      lastReviewDate: Date;
      reviewedAreas: Set<string>;
    }
  >();

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

    // Get the PR data for this review
    const pr = review.pull_request || prMap.get(review.pull_request_id);
    const prTitle = pr?.title || '';
    const titleLower = prTitle.toLowerCase();

    // Extract expertise areas from PR titles
    if (titleLower.includes('auth') || titleLower.includes('login'))
      stats.reviewedAreas.add('authentication');
    if (titleLower.includes('api') || titleLower.includes('endpoint'))
      stats.reviewedAreas.add('API');
    if (
      titleLower.includes('ui') ||
      titleLower.includes('frontend') ||
      titleLower.includes('component')
    )
      stats.reviewedAreas.add('frontend');
    if (titleLower.includes('test') || titleLower.includes('spec'))
      stats.reviewedAreas.add('testing');
    if (titleLower.includes('docs') || titleLower.includes('readme'))
      stats.reviewedAreas.add('documentation');
    if (
      titleLower.includes('database') ||
      titleLower.includes('db') ||
      titleLower.includes('migration')
    )
      stats.reviewedAreas.add('database');
    if (titleLower.includes('deploy') || titleLower.includes('ci') || titleLower.includes('cd'))
      stats.reviewedAreas.add('DevOps');
    if (titleLower.includes('perf') || titleLower.includes('optim'))
      stats.reviewedAreas.add('performance');
    if (titleLower.includes('fix') || titleLower.includes('bug'))
      stats.reviewedAreas.add('bug fixes');
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
    const daysSinceLastReview =
      (Date.now() - stats.lastReviewDate.getTime()) / (24 * 60 * 60 * 1000);
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
        signals.length * 0.05 +
        areas.length * 0.05,
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

  // If we have few suggestions, add active contributors as fallback
  if (suggestions.length < 3) {
    console.log('Adding active contributors as fallback suggestions');

    // Get active contributors from recent commits
    const { data: activeContributors, error: contribError } = await supabase
      .from('commits')
      .select(
        `
        author:contributors!author_id(username, avatar_url)
      `
      )
      .eq('repository_id', repositoryId)
      .gte('committed_date', ninetyDaysAgo)
      .not('author_id', 'is', null)
      .limit(50);

    if (!contribError && activeContributors) {
      const contributorActivity = new Map<string, { count: number; avatarUrl?: string }>();

      for (const commit of activeContributors) {
        const username = commit.author?.username;
        if (!username || username === prAuthor) continue;

        // Skip if already in suggestions
        if (suggestions.some((s) => s.handle === username)) continue;

        const activity = contributorActivity.get(username) || {
          count: 0,
          avatarUrl: commit.author?.avatar_url,
        };
        activity.count++;
        contributorActivity.set(username, activity);
      }

      // Add top active contributors who aren't already reviewers
      const activeContribs = Array.from(contributorActivity.entries())
        .filter(([username]) => !reviewerStats.has(username))
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, Math.max(0, 5 - suggestions.length));

      for (const [username, activity] of activeContribs) {
        suggestions.push({
          handle: username,
          reason: `${username} is an active contributor with ${activity.count} recent commits`,
          confidence: 0.4,
          signals: ['Active contributor', `${activity.count} recent commits`],
          metadata: {
            avatarUrl: activity.avatarUrl,
            reviewCount: 0,
            lastReviewDate: new Date().toISOString(),
            score: activity.count * 2,
          },
        });
      }
    }
  }

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
        const escapedPattern = pattern
          .replace(/^\//, '')
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape all regex special characters
          .replace(/\\\*/g, '.*'); // Then replace escaped * with .*
        const regex = new RegExp('^' + escapedPattern + '$');
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
      fileOwners.forEach((o) => {
        // Remove @ and keep both individual handles and org/team format
        const owner = o.substring(1);
        // For teams (org/team format), we'll keep them as-is for now
        // In a production system, we'd resolve team members via GitHub API
        owners.add(owner);
      });
    }
  }

  return owners;
}

// Trigger rebuild with database schema fixes
export default async (req: Request, context: Context) => {
  const requestId = generateRequestId();
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    const error = APIErrorHandler.createError(
      'CONFIG_ERROR',
      'server_error',
      'Missing Supabase configuration',
      'Service configuration error. Please contact support.',
      { requestId, retryable: false }
    );
    return new Response(JSON.stringify(APIErrorHandler.createResponse(null, error, requestId)), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const limiter = new RateLimiter(supabaseUrl, supabaseKey, {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  });

  // Initialize cache with 30-minute TTL
  const cache = new ReviewerCache(
    supabaseUrl,
    supabaseKey,
    parseInt(process.env.REVIEWER_CACHE_TTL_MINUTES || '30', 10)
  );

  if (req.method === 'OPTIONS') return new Response('', { status: 200, headers: CORS_HEADERS });
  if (req.method !== 'POST') return createErrorResponse('Method not allowed', 405);

  try {
    const rateKey = getRateLimitKey(req);
    const rate = await limiter.checkLimit(rateKey);
    if (!rate.allowed)
      return applyRateLimitHeaders(createErrorResponse('Rate limit exceeded', 429), rate);

    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    const apiIndex = parts.findIndex((p) => p === 'api');
    if (apiIndex === -1 || parts.length < apiIndex + 5)
      return createErrorResponse('Invalid API path format');

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

    // If PR URL is provided, fetch files and author from GitHub
    if (typeof prUrl === 'string') {
      try {
        const url = new URL(prUrl);
        if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
          throw new Error('Invalid GitHub URL');
        }
        const m = url.pathname.match(/^\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);
        if (m) {
          owner = m[1];
          repo = m[2];
          const prNumber = parseInt(m[3], 10);

          // Try multiple token sources for better auth coverage
          const ghToken =
            process.env.GITHUB_TOKEN ||
            process.env.VITE_GITHUB_TOKEN ||
            process.env.GH_TOKEN ||
            process.env.SUPABASE_SERVICE_KEY || // Sometimes used as fallback
            '';

          const headers: HeadersInit = {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          };

          if (ghToken && ghToken.length > 10) {
            headers['Authorization'] = `Bearer ${ghToken}`;
          }

          console.log(`Attempting to fetch PR details and files for: ${prUrl}`);

          // Fetch PR details first to get the author
          if (!prAuthor) {
            try {
              const prDetailsResp = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
                { headers }
              );

              if (prDetailsResp.ok) {
                const prDetails = await prDetailsResp.json();
                // Get the author's username from the PR
                prAuthor = prDetails.user?.login;
                console.log(`PR author extracted: ${prAuthor}`);
              } else {
                console.warn(
                  `Could not fetch PR details (${prDetailsResp.status}). Proceeding without author.`
                );
              }
            } catch (e) {
              console.warn('Failed to fetch PR author:', e);
            }
          }

          // Fetch PR files (paginated)
          const collected: string[] = [];
          for (let page = 1; page <= 3; page++) {
            const r = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
              { headers }
            );
            if (!r.ok) {
              const errorBody = await r.text();
              console.error(
                `Failed to fetch PR files: ${r.status} ${r.statusText}. Body: ${errorBody}`
              );

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
                  interface PullRequestFile {
                    filename?: string;
                    [key: string]: unknown;
                  }
                  const pageFiles = Array.isArray(arr)
                    ? arr.map((f: PullRequestFile) => f.filename).filter(Boolean)
                    : [];
                  collected.push(...pageFiles);
                  if (pageFiles.length < 100) break;
                  continue;
                }
              }

              if (page === 1 && collected.length === 0) {
                // Only fail if we couldn't get any files
                console.warn(
                  `Could not fetch PR files from GitHub (${r.status}). Will proceed without file analysis.`
                );
                // Don't return error - continue with empty files array
              }
              break;
            }
            const arr = await r.json();
            interface PullRequestFile {
              filename?: string;
              [key: string]: unknown;
            }
            const pageFiles = Array.isArray(arr)
              ? arr.map((f: PullRequestFile) => f.filename).filter(Boolean)
              : [];
            collected.push(...pageFiles);
            if (pageFiles.length < 100) break;
          }
          if (collected.length > 0) {
            files = collected;
          }
        }
      } catch (e) {
        console.warn('Failed to parse PR URL:', e);
      }
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      const error = APIErrorHandler.createError(
        'INVALID_FILES_PARAMETER',
        'validation',
        'Missing or invalid files parameter',
        prUrl
          ? 'Unable to fetch changed files from the provided PR URL. Please check the URL and try again.'
          : 'Please provide a list of changed files or a valid PR URL.',
        {
          requestId,
          retryable: false,
          details: {
            expectedFormat: 'Array of file paths',
            received: typeof files,
            prUrl: prUrl || null,
          },
        }
      );

      return new Response(JSON.stringify(APIErrorHandler.createResponse(null, error, requestId)), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const prFiles = await analyzePRFiles(files);

    // Get repository ID from the repositories table (not tracked_repositories)
    // This is what pull_requests table references
    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .or(`and(owner.eq.${owner},name.eq.${repo}),full_name.eq.${owner}/${repo}`)
      .maybeSingle();

    if (repoError) {
      const error = APIErrorHandler.handleDatabaseError(repoError, 'repository lookup', requestId);
      return new Response(JSON.stringify(APIErrorHandler.createResponse(null, error, requestId)), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!repository) {
      const error = APIErrorHandler.createError(
        'REPOSITORY_NOT_FOUND',
        'not_found',
        `Repository ${owner}/${repo} not found in database`,
        `Repository ${owner}/${repo} needs to be tracked and have data synchronized before using this feature.`,
        {
          requestId,
          retryable: false,
          details: {
            trackingUrl: `https://contributor.info/${owner}/${repo}`,
            action: 'track_repository',
            suggestion:
              'Please ensure the repository is tracked and has completed initial data sync',
          },
        }
      );
      return new Response(JSON.stringify(APIErrorHandler.createResponse(null, error, requestId)), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // If we still don't have a PR author but have a PR URL, try to get it from the database
    if (!prAuthor && typeof prUrl === 'string') {
      try {
        const url = new URL(prUrl);
        if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
          throw new Error('Invalid GitHub URL');
        }
        const prMatch = url.pathname.match(/\/pull\/(\d+)/);
        if (prMatch) {
          const prNumber = parseInt(prMatch[1], 10);
          console.log(`Attempting to fetch PR author from database for PR #${prNumber}`);

          // Try to get the PR author from the database
          const { data: prData, error: prError } = await supabase
            .from('pull_requests')
            .select('author:contributors!author_id(username)')
            .eq('repository_id', repository.id)
            .eq('number', prNumber)
            .maybeSingle();

          if (prData?.author?.username) {
            prAuthor = prData.author.username;
            console.log(`PR author found in database: ${prAuthor}`);
          } else {
            console.warn(`Could not find PR #${prNumber} in database`);
          }
        }
      } catch (e) {
        console.warn('Failed to parse PR URL for author lookup:', e);
      }
    }

    // Check cache first
    const cacheKey = files;
    const cachedData = await cache.get(repository.id, cacheKey, prAuthor);

    if (cachedData) {
      console.log(`Returning cached reviewer suggestions for ${owner}/${repo}`);

      // Return cached response with cache hit header
      const resp = new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'X-Cache-Status': 'hit',
        },
      });
      return applyRateLimitHeaders(resp, rate);
    }

    // Get reviewer suggestions from history
    let suggestions = await getReviewerSuggestionsFromHistory(
      repository.id,
      prFiles,
      prAuthor,
      supabase
    );

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

      // Add code owners to suggestions with high priority (but exclude PR author)
      for (const codeOwner of codeOwners) {
        // Skip if code owner is the PR author
        if (codeOwner === prAuthor) {
          console.log(`Skipping code owner ${codeOwner} as they are the PR author`);
          continue;
        }

        // Check if it's a team (contains /)
        const isTeam = codeOwner.includes('/');

        if (isTeam) {
          // Add team as a special suggestion
          suggestions.unshift({
            handle: codeOwner,
            reason: `Team @${codeOwner} is listed as a code owner for the modified files`,
            confidence: 0.95,
            signals: ['code_owner', 'team'],
            metadata: {
              score: 30,
            },
          });
        } else {
          // Handle individual code owner
          const existingIndex = suggestions.findIndex((s) => s.handle === codeOwner);
          if (existingIndex >= 0) {
            // Boost existing reviewer who is also a code owner
            suggestions[existingIndex].signals.unshift('code_owner');
            suggestions[existingIndex].reason =
              `${codeOwner} is a code owner and ${suggestions[existingIndex].reason}`;
            suggestions[existingIndex].confidence = Math.min(
              suggestions[existingIndex].confidence + 0.2,
              0.99
            );
            if (suggestions[existingIndex].metadata) {
              suggestions[existingIndex].metadata!.score += 25;
            }
          } else {
            // Add new individual code owner
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
    }

    // Re-sort after adding code owners
    suggestions.sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0));

    // Take top suggestions
    const topSuggestions = suggestions.slice(0, 10);

    const responseData = APIErrorHandler.createResponse(
      {
        suggestions: topSuggestions,
        codeOwners,
        repository: `${owner}/${repo}`,
        filesAnalyzed: files.length,
        directoriesAffected: prFiles.directories.size,
        generatedAt: new Date().toISOString(),
      },
      undefined,
      requestId
    );

    // Store in cache for future requests
    await cache.set(repository.id, cacheKey, responseData, prAuthor);

    const resp = new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'X-Cache-Status': 'miss',
      },
    });

    return applyRateLimitHeaders(resp, rate);
  } catch (error) {
    const apiError = APIErrorHandler.createError(
      'INTERNAL_SERVER_ERROR',
      'server_error',
      `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'An unexpected error occurred. Please try again or contact support if the problem persists.',
      {
        requestId,
        retryable: true,
        details: {
          endpoint: 'suggest-reviewers',
          timestamp: new Date().toISOString(),
        },
      }
    );

    console.error('API Error:', {
      requestId,
      endpoint: 'suggest-reviewers',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify(APIErrorHandler.createResponse(null, apiError, requestId)), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/suggest-reviewers',
};
