import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation.mts';
import { RateLimiter, getRateLimitKey, applyRateLimitHeaders } from './lib/rate-limiter.mts';

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

async function fetchFileTreeFromDatabase(
  repositoryId: string,
  branch = 'main',
  supabase: ReturnType<typeof createClient>
): Promise<ProcessedTree | null> {
  try {
    // Fetch file tree data from database
    const { data, error } = await supabase
      .from('repository_file_trees')
      .select('tree_data, total_files, total_directories, total_size, truncated')
      .eq('repository_id', repositoryId)
      .eq('branch', branch)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching file tree:', error);
      return null;
    }

    if (!data || !data.tree_data) {
      return null;
    }

    // Convert stored JSON back to ProcessedTree format
    const treeData = data.tree_data as any;

    return {
      files: treeData.files || [],
      directories: treeData.directories || [],
      filesByDirectory: new Map(Object.entries(treeData.filesByDirectory || {})),
      totalSize: data.total_size || 0,
      truncated: data.truncated || false,
    };
  } catch (error) {
    console.error('Error fetching file tree from database:', error);
    return null;
  }
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

      // Extract directory
      const lastSlash = node.path.lastIndexOf('/');
      if (lastSlash > 0) {
        const dir = node.path.substring(0, lastSlash);
        directories.add(dir);

        if (!filesByDirectory.has(dir)) {
          filesByDirectory.set(dir, []);
        }
        filesByDirectory.get(dir)!.push(node.path.substring(lastSlash + 1));

        // Add all parent directories
        const parts = dir.split('/');
        for (let i = 1; i < parts.length; i++) {
          const parentDir = parts.slice(0, i).join('/');
          directories.add(parentDir);
        }
      } else {
        // Root level file
        if (!filesByDirectory.has('')) {
          filesByDirectory.set('', []);
        }
        filesByDirectory.get('')!.push(node.path);
      }
    } else if (node.type === 'tree') {
      directories.add(node.path);
    }
  }

  return {
    files,
    directories: Array.from(directories).sort(),
    filesByDirectory,
    totalSize,
    truncated: data.truncated,
  };
}

function buildHierarchicalStructure(processedTree: ProcessedTree) {
  const root: any = { name: '/', type: 'directory', children: {} };

  // Add directories
  for (const dir of processedTree.directories) {
    const parts = dir.split('/');
    let current = root;

    for (const part of parts) {
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          type: 'directory',
          path: dir,
          children: {},
        };
      }
      current = current.children[part];
    }
  }

  // Add files
  for (const file of processedTree.files) {
    const parts = file.split('/');
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          type: 'directory',
          children: {},
        };
      }
      current = current.children[part];
    }

    const fileName = parts[parts.length - 1];
    current.children[fileName] = {
      name: fileName,
      type: 'file',
      path: file,
    };
  }

  return root;
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

    // Get query parameters
    const branch = url.searchParams.get('branch') || undefined;
    const format = url.searchParams.get('format') || 'flat'; // 'flat' or 'hierarchical'

    const validation = await validateRepository(owner, repo, supabase);
    if (!validation.isTracked) {
      return createNotFoundResponse(owner, repo, validation.trackingUrl);
    }
    if (validation.error) {
      return createErrorResponse(validation.error);
    }

    const { data: repository, error: repoError } = await supabase
      .from('tracked_repositories')
      .select('id, default_branch')
      .eq('owner', owner.toLowerCase())
      .eq('name', repo.toLowerCase())
      .maybeSingle();

    if (repoError || !repository) {
      return createNotFoundResponse(owner, repo);
    }

    const actualBranch = branch || repository.default_branch || 'main';

    // First try to fetch from database
    let processedTree = await fetchFileTreeFromDatabase(repository.id, actualBranch, supabase);

    // If not in database, fetch from GitHub API
    if (!processedTree) {
      const ghToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN || '';
      const headers: HeadersInit = { Accept: 'application/vnd.github+json' };
      if (ghToken) headers['Authorization'] = `Bearer ${ghToken}`;

      const treeResp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${actualBranch}?recursive=1`,
        { headers }
      );

      if (!treeResp.ok) {
        return applyRateLimitHeaders(
          createErrorResponse(`Failed to fetch repository tree: ${treeResp.statusText}`, 502),
          rate
        );
      }

      const data = (await treeResp.json()) as FileTreeResponse;
      processedTree = processTreeData(data);
    }

    // Prepare response based on format
    let responseData: any = {
      repository: `${owner}/${repo}`,
      totalFiles: processedTree.files.length,
      totalDirectories: processedTree.directories.length,
      totalSize: processedTree.totalSize,
      truncated: processedTree.truncated,
    };

    if (format === 'hierarchical') {
      responseData.tree = buildHierarchicalStructure(processedTree);
    } else {
      // Flat format
      responseData.files = processedTree.files;
      responseData.directories = processedTree.directories;

      // Include directory contents if requested
      if (url.searchParams.get('includeDirectoryContents') === 'true') {
        responseData.filesByDirectory = Object.fromEntries(processedTree.filesByDirectory);
      }
    }

    // Add statistics
    const fileExtensions = new Map<string, number>();
    for (const file of processedTree.files) {
      const lastDot = file.lastIndexOf('.');
      if (lastDot > 0 && lastDot < file.length - 1) {
        const ext = file.substring(lastDot + 1);
        fileExtensions.set(ext, (fileExtensions.get(ext) || 0) + 1);
      }
    }

    responseData.statistics = {
      fileTypes: Object.fromEntries(
        Array.from(fileExtensions.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
      ),
      averageFileSize: processedTree.files.length > 0
        ? Math.round(processedTree.totalSize / processedTree.files.length)
        : 0,
    };

    const resp = new Response(
      JSON.stringify(responseData, null, 2),
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      }
    );
    return applyRateLimitHeaders(resp, rate);
  } catch (error) {
    console.error('Error in api-file-tree:', error);
    return createErrorResponse(
      `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/file-tree',
};