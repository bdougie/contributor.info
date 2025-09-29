import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation.ts';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter.mjs';

interface ReviewerSuggestion {
  username: string;
  avatarUrl?: string;
  score: number;
  reasoning: string[];
  relevantFiles: string[];
  recentActivity: boolean;
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
    const lastSlash = file.lastIndexOf('/');
    if (lastSlash > 0) {
      const dir = file.substring(0, lastSlash);
      const parts = dir.split('/');
      for (let i = 1; i <= parts.length; i++) directories.add(parts.slice(0, i).join('/'));
    }
    const lastDot = file.lastIndexOf('.');
    if (lastDot > 0 && lastDot < file.length - 1) fileTypes.add(file.substring(lastDot + 1));
  }
  return { files, directories, fileTypes };
}

async function getContributorScores(owner: string, repo: string, prFiles: PullRequestFiles, supabase: ReturnType<typeof createClient>, repositoryId: string): Promise<Map<string, ReviewerSuggestion>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get file contributors for this repository
  const { data, error } = await supabase
    .from('file_contributors')
    .select(`
      file_path,
      contributor_id,
      commit_count,
      additions,
      deletions,
      last_commit_at,
      contributor:contributors!inner(username, avatar_url)
    `)
    .eq('repository_id', repositoryId)
    .gte('last_commit_at', thirtyDaysAgo)
    .order('commit_count', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Failed to fetch contributor data:', error);
    throw new Error('Failed to fetch contribution data');
  }

  const reviewerMap = new Map<string, ReviewerSuggestion>();

  for (const c of data || []) {
    const username = c.contributor?.username;
    if (!username) continue;

    const relevantFiles: string[] = [];
    const reasoning: string[] = [];
    let score = 0;

    // Check if contributor worked on same files
    const filePath = c.file_path;
    if (filePath && prFiles.files.includes(filePath)) {
      relevantFiles.push(filePath);
      score += 10;
      if (!reasoning.includes('Has modified the same files')) reasoning.push('Has modified the same files');
    }

    // Check if contributor worked in same directories
    if (filePath) {
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      if (dir && prFiles.directories.has(dir)) {
        score += 5;
        if (!reasoning.includes('Familiar with affected directories')) reasoning.push('Familiar with affected directories');
      }

      // Check file type experience
      const ext = filePath.substring(filePath.lastIndexOf('.') + 1);
      if (ext && prFiles.fileTypes.has(ext)) {
        score += 2;
        const reason = `Experience with .${ext} files`;
        if (!reasoning.includes(reason)) reasoning.push(reason);
      }
    }

    // Check recency of contributions
    const last = c.last_commit_at ? new Date(c.last_commit_at) : null;
    const days = last ? (Date.now() - last.getTime()) / 86400000 : 999;
    const recentActivity = days < 7;

    if (recentActivity) {
      score += 5;
      reasoning.push('Active in the past week');
    } else if (days < 30) {
      score += 2;
      reasoning.push('Active in the past month');
    }

    // Add score based on commit count (capped at 10)
    score += Math.min(c.commit_count || 0, 10);

    if (score > 0) {
      const existing = reviewerMap.get(username);
      if (existing) {
        existing.score += score;
        existing.reasoning = [...new Set([...existing.reasoning, ...reasoning])];
        existing.relevantFiles = [...new Set([...existing.relevantFiles, ...relevantFiles])].slice(0, 5);
        existing.recentActivity = existing.recentActivity || recentActivity;
      } else {
        reviewerMap.set(username, {
          username,
          avatarUrl: c.contributor?.avatar_url,
          score,
          reasoning,
          relevantFiles: relevantFiles.slice(0, 5),
          recentActivity,
        });
      }
    }
  }
  return reviewerMap;
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
        if (f.startsWith(pattern.replace(/^\//, ''))) { matches = true; break; }
      } else if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/^\//, '').replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
        if (regex.test(f)) { matches = true; break; }
      } else {
        if (f === pattern.replace(/^\//, '')) { matches = true; break; }
      }
    }
    if (matches) fileOwners.forEach((o) => owners.add(o.substring(1)));
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

    const validation = await validateRepository(owner, repo, supabase);
    if (!validation.isTracked) return createNotFoundResponse(owner, repo, validation.trackingUrl);
    if (validation.error) return createErrorResponse(validation.error);

    const body = await req.json();
    let { files, prAuthor, prUrl } = body || {};

    // If PR URL is provided, derive owner/repo and changed files automatically
    if (typeof prUrl === 'string' && prUrl.includes('github.com')) {
      const m = prUrl.match(/github\.com\/(.*?)\/(.*?)\/pull\/(\d+)/i);
      if (m) {
        owner = m[1];
        repo = m[2];
        const prNumber = parseInt(m[3], 10);
        const ghToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN || '';
        const headers: HeadersInit = { Accept: 'application/vnd.github+json' };
        if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

        // Paginate PR files (up to 300 files)
        const collected: string[] = [];
        for (let page = 1; page <= 3; page++) {
          const r = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
            { headers }
          );
          if (!r.ok) break;
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
      return createErrorResponse('Please provide a PR URL or an array of files changed in the PR');
    }

    const prFiles = await analyzePRFiles(files);
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

    const reviewerMap = await getContributorScores(owner, repo, prFiles, supabase, repository.id);

    let codeOwners: string[] = [];
    const { data: coData } = await supabase
      .from('codeowners')
      .select('content')
      .eq('repository_id', repository.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (coData?.content) {
      const set = parseCodeOwners(coData.content, prFiles);
      codeOwners = Array.from(set);
      for (const codeOwner of codeOwners) {
        const existing = reviewerMap.get(codeOwner);
        if (existing) {
          existing.score += 20;
          existing.reasoning.unshift('Listed in CODEOWNERS');
        } else {
          reviewerMap.set(codeOwner, {
            username: codeOwner,
            score: 20,
            reasoning: ['Listed in CODEOWNERS'],
            relevantFiles: [],
            recentActivity: false,
          });
        }
      }
    }

    const suggestions = Array.from(reviewerMap.values())
      .filter((r) => r.username !== prAuthor)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const primary = suggestions.filter((s) => s.score >= 20);
    const secondary = suggestions.filter((s) => s.score >= 10 && s.score < 20);
    const additional = suggestions.filter((s) => s.score < 10);

    const resp = new Response(
      JSON.stringify({
        suggestions: { primary, secondary, additional },
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
