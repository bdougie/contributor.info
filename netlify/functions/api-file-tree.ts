import type { Context } from '@netlify/functions';
import { createSupabaseClient } from '../src/lib/supabase';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter';

interface TreeNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
  url: string;
}

interface FileTreeResponse {
  sha: string;
  url: string;
  tree: TreeNode[];
  truncated: boolean;
}

interface ProcessedTree {
  files: string[];
  directories: string[];
  filesByDirectory: Map<string, string[]>;
  totalSize: number;
  truncated: boolean;
}

function processTreeData(data: FileTreeResponse): ProcessedTree {
  const files: string[] = [];
  const directories = new Set<string>();
  const filesByDirectory = new Map<string, string[]>();
  let totalSize = 0;
  for (const node of data.tree) {
    if (node.type === 'blob') {
      files.push(node.path);
      totalSize += node.size || 0;
      const lastSlash = node.path.lastIndexOf('/');
      if (lastSlash > 0) {
        const dir = node.path.substring(0, lastSlash);
        directories.add(dir);
        if (!filesByDirectory.has(dir)) filesByDirectory.set(dir, []);
        filesByDirectory.get(dir)!.push(node.path.substring(lastSlash + 1));
        const parts = dir.split('/');
        for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/'));
      } else {
        if (!filesByDirectory.has('')) filesByDirectory.set('', []);
        filesByDirectory.get('')!.push(node.path);
      }
    } else if (node.type === 'tree') {
      directories.add(node.path);
    }
  }
  return { files, directories: Array.from(directories).sort(), filesByDirectory, totalSize, truncated: data.truncated };
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
  if (req.method !== 'GET') return createErrorResponse('Method not allowed', 405);

  try {
    const rateKey = getRateLimitKey(req);
    const rate = await limiter.checkLimit(rateKey);
    if (!rate.allowed) return applyRateLimitHeaders(createErrorResponse('Rate limit exceeded', 429), rate);

    const url = new URL(req.url);
    const parts = url.pathname.split('/');
    const apiIndex = parts.findIndex((p) => p === 'api');
    if (apiIndex === -1 || parts.length < apiIndex + 5) return createErrorResponse('Invalid API path format');
    const owner = parts[apiIndex + 2];
    const repo = parts[apiIndex + 3];

    const validation = await validateRepository(owner, repo);
    if (!validation.isTracked) return createNotFoundResponse(owner, repo, validation.trackingUrl);
    if (validation.error) return createErrorResponse(validation.error);

    const supabase = createSupabaseClient();
    const { data: repository } = await supabase
      .from('repositories')
      .select('default_branch')
      .eq('owner', owner.toLowerCase())
      .eq('name', repo.toLowerCase())
      .maybeSingle();
    const branch = repository?.default_branch || 'main';

    const ghToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN || '';
    const headers: HeadersInit = { Accept: 'application/vnd.github+json' };
    if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

    const treeResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, { headers });
    if (!treeResp.ok) return createErrorResponse(`Failed to fetch repository tree: ${treeResp.statusText}`, 502);
    const data = (await treeResp.json()) as FileTreeResponse;
    const processed = processTreeData(data);

    const resp = new Response(
      JSON.stringify({
        files: processed.files,
        directories: processed.directories,
        totalSize: processed.totalSize,
        truncated: processed.truncated,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' } }
    );
    return applyRateLimitHeaders(resp, rate);
  } catch (error) {
    console.error('Error in api-file-tree:', error);
    return createErrorResponse(`Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/file-tree',
};
