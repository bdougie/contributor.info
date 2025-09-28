import type { Context } from '@netlify/functions';
import {
  validateRepository,
  createNotFoundResponse,
  createErrorResponse,
  CORS_HEADERS,
} from './lib/repository-validation';

interface CodeOwnersResponse {
  content?: string;
  exists: boolean;
  path?: string;
  error?: string;
}

async function fetchCodeOwners(
  owner: string,
  repo: string,
  token: string
): Promise<CodeOwnersResponse> {
  // Check multiple possible locations for CODEOWNERS file
  const possiblePaths = [
    '.github/CODEOWNERS',
    'CODEOWNERS',
    'docs/CODEOWNERS',
    '.gitlab/CODEOWNERS',
  ];

  for (const path of possiblePaths) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        // Decode base64 content
        if (data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return {
            content,
            exists: true,
            path: data.path,
          };
        }
      }
    } catch (error) {
      console.error(`Error fetching CODEOWNERS from ${path}:`, error);
    }
  }

  return {
    exists: false,
    error: 'No CODEOWNERS file found in repository',
  };
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

    // Expected path: /api/repos/:owner/:repo/codeowners
    const apiIndex = pathParts.findIndex(part => part === 'api');
    if (apiIndex === -1 || pathParts.length < apiIndex + 5) {
      return createErrorResponse('Invalid API path format');
    }

    const owner = pathParts[apiIndex + 2];
    const repo = pathParts[apiIndex + 3];

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

    // Fetch CODEOWNERS file
    const codeOwnersData = await fetchCodeOwners(owner, repo, token);

    if (!codeOwnersData.exists) {
      return new Response(
        JSON.stringify({
          exists: false,
          message: codeOwnersData.error || 'No CODEOWNERS file found',
          checkedPaths: [
            '.github/CODEOWNERS',
            'CODEOWNERS',
            'docs/CODEOWNERS',
            '.gitlab/CODEOWNERS',
          ],
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

    // Parse and return CODEOWNERS content
    return new Response(
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
          'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        },
      }
    );
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