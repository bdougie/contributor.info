import type { Context } from '@netlify/functions';
import { createSupabaseClient } from '../src/lib/supabase';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter';

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

async function getContributorScores(owner: string, repo: string, prFiles: PullRequestFiles): Promise<Map<string, ReviewerSuggestion>> {
  const supabase = createSupabaseClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('github_contributions')
    .select(`contributor:github_contributors!inner(username,avatar_url), additions, deletions, commits, files_changed, last_contributed_at`)
    .eq('repository_id', `${owner}/${repo}`.toLowerCase())
    .gte('last_contributed_at', thirtyDaysAgo)
    .order('commits', { ascending: false })
    .limit(50);
  if (error) throw new Error('Failed to fetch contribution data');

  const reviewerMap = new Map<string, ReviewerSuggestion>();
  for (const c of data || []) {
    const username = c.contributor?.username;
    if (!username) continue;
    const relevantFiles: string[] = [];
    const reasoning: string[] = [];
    let score = 0;
    if (Array.isArray(c.files_changed)) {
      for (const f of c.files_changed) {
        if (typeof f !== 'string') continue;
        if (prFiles.files.includes(f)) {
          relevantFiles.push(f);
          score += 10;
          if (!reasoning.includes('Has modified the same files')) reasoning.push('Has modified the same files');
        }
        const dir = f.substring(0, f.lastIndexOf('/'));
        if (dir && prFiles.directories.has(dir)) {
          score += 5;
          if (!reasoning.includes('Familiar with affected directories')) reasoning.push('Familiar with affected directories');
        }
        const ext = f.substring(f.lastIndexOf('.') + 1);
        if (ext && prFiles.fileTypes.has(ext)) {
          score += 2;
          const reason = `Experience with .${ext} files`;
          if (!reasoning.includes(reason)) reasoning.push(reason);
        }
      }
    }
    const last = c.last_contributed_at ? new Date(c.last_contributed_at) : null;
    const days = last ? (Date.now() - last.getTime()) / 86400000 : 999;
    const recentActivity = days < 7;
    if (recentActivity) {
      score += 5;
      reasoning.push('Active in the past week');
    } else if (days < 30) {
      score += 2;
      reasoning.push('Active in the past month');
    }
    score += Math.min(c.commits || 0, 10);
    if (score > 0) {
      const existing = reviewerMap.get(username);
      if (existing) {
        existing.score += score;
        existing.reasoning = [...new Set([...existing.reasoning, ...reasoning])];
        existing.relevantFiles = [...new Set([...existing.relevantFiles, ...relevantFiles])].slice(0, 5);
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

    const validation = await validateRepository(owner, repo);
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
    const supabase = createSupabaseClient();
    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner.toLowerCase())
      .eq('name', repo.toLowerCase())
      .maybeSingle();
    if (repoError || !repository) return createNotFoundResponse(owner, repo);

    const reviewerMap = await getContributorScores(owner, repo, prFiles);

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
