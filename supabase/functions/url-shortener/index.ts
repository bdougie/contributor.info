import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const DUB_API_BASE = "https://api.dub.co";

interface CreateShortUrlRequest {
  url: string;
  key?: string;
  title?: string;
  description?: string;
  expiresAt?: string;
  rewrite?: boolean;
  domain?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

interface ShortUrlResponse {
  id: string;
  domain: string;
  key: string;
  url: string;
  shortLink: string;
  qrCode: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  clicks: number;
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

/**
 * Validate URL for security
 */
function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Allow contributor.info domains and localhost for development
    return (
      urlObj.host.endsWith("contributor.info") ||
      urlObj.host.includes("localhost") ||
      urlObj.host.endsWith("netlify.app") || // Allow Netlify preview deployments
      urlObj.host.endsWith("vercel.app") // Allow Vercel deployments
    );
  } catch {
    return false;
  }
}

/**
 * Generate a custom key from URL
 */
function getCustomKey(url: string): string | undefined {
  try {
    const urlPath = new URL(url).pathname;
    
    // ex: /owner/repo (repository pages)
    const repoMatch = urlPath.match(/^\/([^\/]+)\/([^\/]+)(?:\/.*)?$/);
    if (repoMatch) {
      return `${repoMatch[1]}/${repoMatch[2]}`;
    }
    
    // ex: /u/username or /user/username 
    const userMatch = urlPath.match(/^\/(u|user)\/(.+)$/);
    if (userMatch) {
      return userMatch[2];
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Dub API key from environment
    const dubApiKey = Deno.env.get('DUB_API_KEY');
    if (!dubApiKey) {
      console.error('DUB_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'URL shortening service not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body
    const body: CreateShortUrlRequest = await req.json();
    
    // Validate required fields
    if (!body.url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate URL for security
    if (!validateUrl(body.url)) {
      console.warn('Invalid URL for shortening:', body.url);
      return new Response(
        JSON.stringify({ error: 'Invalid URL domain' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Determine domain based on environment
    const isProduction = !body.url.includes('localhost');
    const domain = body.domain || (isProduction ? "oss.fyi" : "dub.sh");

    // Generate custom key if not provided
    const customKey = body.key || getCustomKey(body.url);

    // Prepare Dub API request
    const dubRequest = {
      url: body.url,
      domain,
      key: customKey,
      title: body.title,
      description: body.description,
      expiresAt: body.expiresAt,
      rewrite: body.rewrite || false,
      utmSource: body.utmSource || "contributor-info",
      utmMedium: body.utmMedium || "chart-share",
      utmCampaign: body.utmCampaign || "social-sharing"
    };

    console.log('Creating short URL with Dub API:', {
      url: body.url,
      domain,
      key: customKey,
      hasApiKey: !!dubApiKey
    });

    // Make request to Dub API
    const dubResponse = await fetch(`${DUB_API_BASE}/links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dubApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dubRequest),
    });

    if (!dubResponse.ok) {
      const errorText = await dubResponse.text();
      console.error('Dub API error:', {
        status: dubResponse.status,
        statusText: dubResponse.statusText,
        error: errorText
      });

      // Return error response
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create short URL',
          details: errorText,
          status: dubResponse.status 
        }),
        { 
          status: dubResponse.status >= 500 ? 500 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await dubResponse.json();
    console.log('Dub API success:', result.shortLink);

    // Map the response to our interface
    const response: ShortUrlResponse = {
      id: result.id,
      domain: result.domain,
      key: result.key,
      url: result.url,
      shortLink: result.shortLink,
      qrCode: result.qrCode || '',
      utmSource: result.utmSource,
      utmMedium: result.utmMedium,
      utmCampaign: result.utmCampaign,
      utmTerm: result.utmTerm,
      utmContent: result.utmContent,
      userId: result.userId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      expiresAt: result.expiresAt,
      clicks: result.clicks || 0,
      title: result.title,
      description: result.description,
      image: result.image
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('URL shortener function error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});