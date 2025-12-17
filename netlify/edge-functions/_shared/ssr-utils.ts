/**
 * SSR Utilities for Edge Functions
 *
 * Common utilities for server-side rendering in Netlify Edge Functions.
 * Includes bot detection, error handling, and response helpers.
 */

import type { Context } from '@netlify/edge-functions';

/**
 * User agents for crawlers that should receive SSR content
 */
const CRAWLER_USER_AGENTS = [
  'googlebot',
  'bingbot',
  'slurp', // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'facebookexternalhit',
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'telegrambot',
  'whatsapp',
  'pinterest',
  'applebot',
  'petalbot',
  'semrushbot',
  'ahrefsbot',
];

/**
 * Check if the request is from a crawler/bot
 */
export function isCrawler(request: Request): boolean {
  const userAgent = request.headers.get('user-agent');
  if (!userAgent) return false;

  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot));
}

/**
 * Check if SSR should be enabled for this request
 *
 * SSR is enabled for:
 * - All crawlers/bots (SEO)
 * - First-time visitors (better LCP)
 * - Requests without JavaScript capability hints
 */
export function shouldSSR(request: Request): boolean {
  // Always SSR for crawlers
  if (isCrawler(request)) {
    return true;
  }

  // Check if this is an initial document navigation
  const isDocumentRequest = request.headers.get('sec-fetch-dest') === 'document';

  // SSR for document requests (initial page load)
  if (isDocumentRequest) {
    return true;
  }

  // Default to SSR for better initial experience
  return true;
}

/**
 * Format large numbers for display (e.g., 1234 -> "1.2K")
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

/**
 * Format a date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return 'Unknown date';
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Validate and sanitize URL to prevent XSS via dangerous schemes
 * Only allows https: and http: protocols
 * 
 * @param url - The URL to validate
 * @param allowHttp - Whether to allow http: (default: false)
 * @returns The validated URL or a safe placeholder
 */
export function sanitizeUrl(url: string, allowHttp = false): string {
  const PLACEHOLDER_IMAGE = '/icons/icon-192x192.png';
  
  if (!url) return PLACEHOLDER_IMAGE;
  
  try {
    const parsed = new URL(url);
    const allowedProtocols = allowHttp ? ['https:', 'http:'] : ['https:'];
    
    if (!allowedProtocols.includes(parsed.protocol)) {
      console.warn('[ssr] Blocked URL with dangerous protocol: %s', parsed.protocol);
      return PLACEHOLDER_IMAGE;
    }
    
    return url;
  } catch (error) {
    console.warn('[ssr] Invalid URL format: %s', url);
    return PLACEHOLDER_IMAGE;
  }
}

/**
 * Generate a fallback response (pass through to SPA)
 */
export function fallbackToSPA(context: Context): Promise<Response> {
  return context.next();
}

/**
 * Generate a 404 response with basic HTML
 */
export function notFoundResponse(message = 'Page not found'): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Not Found | contributor.info</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 4rem; margin: 0; color: #f97316; }
    p { color: #a1a1aa; margin: 1rem 0 2rem; }
    a { color: #f97316; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>${message}</p>
    <a href="/">Go to homepage</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Generate an error response
 */
export function errorResponse(error: Error, isDev = false): Response {
  console.error('[ssr] Error:', error);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error | contributor.info</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
    .container { text-align: center; padding: 2rem; max-width: 600px; }
    h1 { font-size: 2rem; margin: 0; color: #ef4444; }
    p { color: #a1a1aa; margin: 1rem 0 2rem; }
    pre { background: #1a1a1a; padding: 1rem; border-radius: 0.5rem; overflow: auto; text-align: left; font-size: 0.875rem; }
    a { color: #f97316; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Something went wrong</h1>
    <p>We're sorry, but something went wrong. Please try again later.</p>
    ${isDev ? `<pre>${error.stack || error.message}</pre>` : ''}
    <a href="/">Go to homepage</a>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 500,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

/**
 * Parse owner/repo from URL path
 */
export function parseRepoPath(pathname: string): { owner: string; repo: string } | null {
  // Remove leading slash and split
  const parts = pathname.replace(/^\//, '').split('/');

  if (parts.length < 2) {
    return null;
  }

  const [owner, repo] = parts;

  // Validate owner and repo names (basic GitHub username/repo validation)
  const validPattern = /^[a-zA-Z0-9]([a-zA-Z0-9._-]{0,37}[a-zA-Z0-9])?$/;

  if (!validPattern.test(owner) || !validPattern.test(repo)) {
    return null;
  }

  // Exclude reserved paths
  const reservedPaths = [
    'api',
    'login',
    'logout',
    'callback',
    'settings',
    'admin',
    'dev',
    'docs',
    'changelog',
    'privacy',
    'terms',
    'trending',
    'widgets',
    'workspaces',
    'i',
    'billing',
    'invitation',
  ];

  if (reservedPaths.includes(owner.toLowerCase())) {
    return null;
  }

  return { owner, repo };
}

/**
 * Get environment info
 */
export function getEnvironment(): 'production' | 'staging' | 'development' {
  const env = Deno.env.get('CONTEXT') || Deno.env.get('NETLIFY_ENV');
  if (env === 'dev' || env === 'development') return 'development';
  if (env === 'branch-deploy' || env === 'deploy-preview') return 'staging';
  return 'production';
}

/**
 * Check if we're in development mode
 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development';
}
