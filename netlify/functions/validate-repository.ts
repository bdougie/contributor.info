import type { Handler } from '@netlify/functions';

// Environment variables
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';

interface ValidationResponse {
  status: 'exists_in_db' | 'exists_on_github' | 'not_found';
  repository?: {
    owner: string;
    name: string;
    full_name: string;
    description: string | null;
    stars: number;
    language: string | null;
    private: boolean;
  };
  suggestion?: string;
}

export const handler: Handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Extract owner and repo from path parameters or query string
  const pathParts = event.path.split('/').filter(Boolean);
  let owner: string | undefined;
  let repo: string | undefined;
  
  // Try to get from path: /api/validate-repository/{owner}/{repo}
  if (pathParts.length >= 4) {
    owner = pathParts[pathParts.length - 2];
    repo = pathParts[pathParts.length - 1];
  }
  
  // Fallback to query parameters
  if (!owner || !repo) {
    const params = event.queryStringParameters || {};
    owner = params.owner;
    repo = params.repo;
  }

  if (!owner || !repo) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'Missing required parameters: owner and repo',
        status: 'not_found' 
      }),
    };
  }

  try {
    // Step 1: Check if repository exists in Supabase
    const supabaseCheck = await checkSupabase(owner, repo);
    if (supabaseCheck.exists) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'exists_in_db',
          repository: supabaseCheck.repository,
        } as ValidationResponse),
      };
    }

    // Step 2: Check if repository exists on GitHub
    const githubCheck = await checkGitHub(owner, repo);
    if (githubCheck.exists) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'exists_on_github',
          repository: githubCheck.repository,
          suggestion: 'This repository exists on GitHub but is not yet tracked. It will be added automatically.',
        } as ValidationResponse),
      };
    }

    // Step 3: Repository not found anywhere
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'not_found',
        suggestion: `Repository ${owner}/${repo} was not found. Please check the spelling or try searching for similar repositories.`,
      } as ValidationResponse),
    };
  } catch (error) {
    console.error('Error validating repository:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        status: 'not_found'
      }),
    };
  }
};

async function checkSupabase(owner: string, repo: string): Promise<{ exists: boolean; repository?: any }> {
  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
    console.warn('Supabase credentials not configured, skipping database check');
    return { exists: false };
  }

  try {
    const response = await fetch(
      `${VITE_SUPABASE_URL}/rest/v1/repositories?owner=eq.${owner}&name=eq.${repo}&select=*`,
      {
        headers: {
          'apikey': VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Supabase query failed:', response.status, response.statusText);
      return { exists: false };
    }

    const data = await response.json();
    if (data && data.length > 0) {
      const repo = data[0];
      return {
        exists: true,
        repository: {
          owner: repo.owner,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          stars: repo.stargazers_count || 0,
          language: repo.language,
          private: repo.is_private || false,
        },
      };
    }

    return { exists: false };
  } catch (error) {
    console.error('Error checking Supabase:', error);
    return { exists: false };
  }
}

async function checkGitHub(owner: string, repo: string): Promise<{ exists: boolean; repository?: any }> {
  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };

    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers }
    );

    if (response.status === 404) {
      return { exists: false };
    }

    if (response.status === 403) {
      // Rate limited, but we can't determine if repo exists
      console.warn('GitHub API rate limited');
      return { exists: false };
    }

    if (!response.ok) {
      console.error('GitHub API error:', response.status, response.statusText);
      return { exists: false };
    }

    const data = await response.json();
    return {
      exists: true,
      repository: {
        owner: data.owner.login,
        name: data.name,
        full_name: data.full_name,
        description: data.description,
        stars: data.stargazers_count || 0,
        language: data.language,
        private: data.private || false,
      },
    };
  } catch (error) {
    console.error('Error checking GitHub:', error);
    return { exists: false };
  }
}