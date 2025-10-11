/**
 * CODEOWNERS Edge Function
 * 
 * Fetches CODEOWNERS files from GitHub repositories and caches them in the database.
 * Supports refresh parameter to force reload from GitHub.
 * 
 * @example
 * GET /functions/v1/codeowners?owner=octocat&repo=hello-world
 * GET /functions/v1/codeowners?owner=octocat&repo=hello-world&refresh=true
 * 
 * @returns
 * {
 *   "exists": true,
 *   "content": "# CODEOWNERS file content...",
 *   "path": ".github/CODEOWNERS",
 *   "repository": "octocat/hello-world"
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { 
  successResponse, 
  errorResponse, 
  notFoundError, 
  validationError,
  handleError,
  corsPreflightResponse 
} from '../_shared/responses.ts';

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const githubToken = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('VITE_GITHUB_TOKEN') || '';

interface CodeOwnersResponse {
  content?: string;
  exists: boolean;
  path?: string;
  error?: string;
  message?: string;
  helpUrl?: string;
  checkedPaths?: string[];
  repository?: string;
}

interface TrackedRepository {
  id: string;
  organization_name: string;
  repository_name: string;
}

/**
 * Validates repository access and tracking status
 */
async function validateRepository(
  owner: string, 
  repo: string, 
  supabase: ReturnType<typeof createClient>
): Promise<{ isValid: boolean; repository?: TrackedRepository; error?: string }> {
  try {
    const { data: repository, error: repoError } = await supabase
      .from('tracked_repositories')
      .select('id, organization_name, repository_name')
      .eq('organization_name', owner.toLowerCase())
      .eq('repository_name', repo.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (repoError) {
      return { 
        isValid: false, 
        error: `Database error while fetching repository: ${repoError.message}` 
      };
    }

    if (!repository) {
      return { 
        isValid: false, 
        error: `Repository ${owner}/${repo} is not tracked. Please track this repository first.` 
      };
    }

    return { isValid: true, repository };
  } catch (error) {
    return { 
      isValid: false, 
      error: `Failed to validate repository: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Fetches CODEOWNERS from database cache
 */
async function fetchCodeOwnersFromDatabase(
  repositoryId: string,
  supabase: ReturnType<typeof createClient>
): Promise<CodeOwnersResponse> {
  try {
    const { data, error } = await supabase
      .from('codeowners')
      .select('content, file_path, updated_at')
      .eq('repository_id', repositoryId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching CODEOWNERS: %s', error.message);
      return { exists: false, error: 'Failed to fetch CODEOWNERS from database' };
    }

    if (!data) {
      return { exists: false, error: 'No CODEOWNERS file found in repository' };
    }

    return { content: data.content, exists: true, path: data.file_path };
  } catch (error) {
    console.error('Error fetching CODEOWNERS from database: %s', error instanceof Error ? error.message : String(error));
    return { exists: false, error: 'Failed to fetch CODEOWNERS from database' };
  }
}

/**
 * Fetches CODEOWNERS from GitHub API
 */
async function fetchCodeOwnersFromGitHub(
  owner: string,
  repo: string,
  repositoryId: string,
  supabase: ReturnType<typeof createClient>
): Promise<CodeOwnersResponse> {
  const headers: HeadersInit = { Accept: 'application/vnd.github+json' };
  if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;

  const paths = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS', '.gitlab/CODEOWNERS'];
  
  for (const path of paths) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          const content = new TextDecoder().decode(
            Uint8Array.from(atob(data.content), c => c.charCodeAt(0))
          );

          // Save to database for future use
          try {
            const { error: insertError } = await supabase
              .from('codeowners')
              .upsert({
                id: crypto.randomUUID(),
                repository_id: repositoryId,
                file_path: path,
                content: content,
                sha: data.sha,
                fetched_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (insertError) {
              console.error('Failed to save CODEOWNERS to database: %s', insertError.message);
            } else {
              console.log('Saved CODEOWNERS for %s/%s to database', owner, repo);
            }
          } catch (dbError) {
            console.error('Database save error: %s', dbError instanceof Error ? dbError.message : String(dbError));
          }

          return { exists: true, content, path };
        }
      }
    } catch (fetchError) {
      console.warn('Failed to fetch CODEOWNERS from %s: %s', path, fetchError instanceof Error ? fetchError.message : String(fetchError));
      // Continue to next path
    }
  }

  return {
    exists: false,
    message: 'No CODEOWNERS file found in repository',
    helpUrl: 'https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners',
    checkedPaths: paths,
  };
}

/**
 * Main function handler
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return corsPreflightResponse();
  }

  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Parse URL parameters
    const url = new URL(req.url);
    const owner = url.searchParams.get('owner');
    const repo = url.searchParams.get('repo');
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    // Validate required parameters
    if (!owner || !repo) {
      return validationError('Missing required parameters: owner and repo');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate repository
    const validation = await validateRepository(owner, repo, supabase);
    if (!validation.isValid || !validation.repository) {
      return notFoundError('Repository', validation.error);
    }

    const repository = validation.repository;

    // First check database cache (unless force refresh)
    let codeOwnersData: CodeOwnersResponse;
    
    if (!forceRefresh) {
      codeOwnersData = await fetchCodeOwnersFromDatabase(repository.id, supabase);
      
      // If found in cache, return it
      if (codeOwnersData.exists) {
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
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300',
            },
          }
        );
      }
    }

    // Fetch from GitHub (either force refresh or not in cache)
    codeOwnersData = await fetchCodeOwnersFromGitHub(owner, repo, repository.id, supabase);

    // Return response based on what we found
    if (codeOwnersData.exists) {
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
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
          },
        }
      );
    } else {
      // Return 200 with structured empty state
      return new Response(
        JSON.stringify({
          exists: false,
          message: codeOwnersData.message,
          helpUrl: codeOwnersData.helpUrl,
          checkedPaths: codeOwnersData.checkedPaths,
          repository: `${owner}/${repo}`,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300',
          },
        }
      );
    }

  } catch (error) {
    return handleError(error, 'CODEOWNERS fetch');
  }
});