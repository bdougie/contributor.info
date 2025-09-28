import type { Context } from '@netlify/functions';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation';

interface TreeNode {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
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

async function fetchFileTree(
  owner: string,
  repo: string,
  token: string,
  branch = 'main'
): Promise<ProcessedTree> {
  try {
    // First, try to get the default branch
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!repoResponse.ok) {
      throw new Error(`Failed to fetch repository info: ${repoResponse.status}`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch || branch;

    // Get the tree for the default branch
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!treeResponse.ok) {
      // Fallback to 'master' if 'main' fails
      if (defaultBranch === 'main') {
        const masterResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        if (masterResponse.ok) {
          const data: FileTreeResponse = await masterResponse.json();
          return processTreeData(data);
        }
      }

      throw new Error(`Failed to fetch file tree: ${treeResponse.status}`);
    }

    const data: FileTreeResponse = await treeResponse.json();
    return processTreeData(data);
  } catch (error) {
    console.error('Error fetching file tree:', error);
    throw error;
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== 'GET') {
    return createErrorResponse('Method not allowed', 405);
  }

  try {
    // Extract owner and repo from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');

    // Expected path: /api/repos/:owner/:repo/file-tree
    const apiIndex = pathParts.findIndex(part => part === 'api');
    if (apiIndex === -1 || pathParts.length < apiIndex + 5) {
      return createErrorResponse('Invalid API path format');
    }

    const owner = pathParts[apiIndex + 2];
    const repo = pathParts[apiIndex + 3];

    // Get query parameters
    const branch = url.searchParams.get('branch') || undefined;
    const format = url.searchParams.get('format') || 'flat'; // 'flat' or 'hierarchical'

    // Validate repository is tracked
    const validation = await validateRepository(owner, repo);

    if (!validation.isTracked) {
      return createNotFoundResponse(owner, repo, validation.trackingUrl);
    }

    if (validation.error) {
      return createErrorResponse(validation.error);
    }

    // Get GitHub token from environment
    const token = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
    if (!token) {
      return createErrorResponse('GitHub token not configured', 500);
    }

    // Fetch file tree
    const processedTree = await fetchFileTree(owner, repo, token, branch);

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

    return new Response(
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