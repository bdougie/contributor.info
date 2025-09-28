import type { Context } from '@netlify/functions';
import { createSupabaseClient } from '@/lib/supabase';
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

async function fetchCodeOwnersFromDatabase(
  repositoryId: string
): Promise<CodeOwnersResponse> {
  try {
    const supabase = createSupabaseClient();

    // Fetch CODEOWNERS data from database
    const { data, error } = await supabase
      .from('codeowners')
      .select('content, file_path, fetched_at')
      .eq('repository_id', repositoryId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching CODEOWNERS:', error);
      return {
        exists: false,
        error: 'Failed to fetch CODEOWNERS from database',
      };
    }

    if (!data) {
      return {
        exists: false,
        error: 'No CODEOWNERS file found in repository',
      };
    }

    return {
      content: data.content,
      exists: true,
      path: data.file_path,
    };
  } catch (error) {
    console.error('Error fetching CODEOWNERS from database:', error);
    return {
      exists: false,
      error: 'Failed to fetch CODEOWNERS from database',
    };
  }
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

    // Get repository ID from database
    const supabase = createSupabaseClient();
    const { data: repository, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner.toLowerCase())
      .eq('name', repo.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (repoError || !repository) {
      return createNotFoundResponse(owner, repo);
    }

    // Fetch CODEOWNERS file from database
    const codeOwnersData = await fetchCodeOwnersFromDatabase(repository.id);

    if (!codeOwnersData.exists) {
      return new Response(
        JSON.stringify({
          exists: false,
          message: codeOwnersData.error || 'No CODEOWNERS file found in repository',
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
