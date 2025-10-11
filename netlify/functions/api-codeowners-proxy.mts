import type { Context } from '@netlify/functions';

/**
 * Proxy function for CODEOWNERS API migration
 * 
 * This function maintains backward compatibility for the path-based API
 * while redirecting to the new Supabase Edge Function.
 */
export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const parts = url.pathname.split('/');
  const apiIndex = parts.findIndex((p) => p === 'api');
  
  if (apiIndex === -1 || parts.length < apiIndex + 5) {
    return new Response(
      JSON.stringify({ error: 'Invalid API path format' }),
      { 
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
        }
      }
    );
  }
  
  const owner = parts[apiIndex + 2];
  const repo = parts[apiIndex + 3];
  
  // Extract query parameters
  const params = new URLSearchParams({
    owner,
    repo,
  });
  
  // Forward refresh parameter if present
  if (url.searchParams.has('refresh')) {
    params.set('refresh', url.searchParams.get('refresh')!);
  }
  
  // Construct Supabase Edge Function URL
  const supabaseUrl = process.env.SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
  const targetUrl = `${supabaseUrl}/functions/v1/codeowners?${params}`;
  
  try {
    // Forward the request to Supabase Edge Function
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...Object.fromEntries(req.headers.entries()),
        'X-Forwarded-Host': 'contributor.info',
      },
    });
    
    const data = await response.text();
    
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': response.headers.get('Cache-Control') || 'public, max-age=300',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch CODEOWNERS',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    );
  }
};

export const config = {
  path: '/api/repos/:owner/:repo/codeowners',
};