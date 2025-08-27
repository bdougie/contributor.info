/**
 * CORS middleware for Netlify Functions
 */

import type { ApiConfig } from './config';

export interface CorsHeaders {
  [key: string]: string;
}

/**
 * Get CORS headers based on request origin
 */
export function getCorsHeaders(request: Request, config: ApiConfig): CorsHeaders {
  const origin = request.headers.get('Origin') || '';
  const headers: CorsHeaders = {};

  // Check if origin is allowed
  const isAllowedOrigin =
    config.cors.allowedOrigins.includes(origin) || config.cors.allowedOrigins.includes('*');

  if (isAllowedOrigin) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  } else if (config.cors.allowedOrigins.length > 0) {
    // Use first allowed origin as default
    headers['Access-Control-Allow-Origin'] = config.cors.allowedOrigins[0];
  }

  // Add other CORS headers
  headers['Access-Control-Allow-Methods'] = config.cors.allowedMethods.join(', ');
  headers['Access-Control-Allow-Headers'] = config.cors.allowedHeaders.join(', ');

  if (config.cors.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  // Add Vary header to indicate response varies by origin
  headers['Vary'] = 'Origin';

  return headers;
}

/**
 * Handle preflight OPTIONS request
 */
export function handlePreflight(request: Request, config: ApiConfig): Response {
  const headers = getCorsHeaders(request, config);

  // Add max age for preflight caching
  headers['Access-Control-Max-Age'] = '86400'; // 24 hours

  return new Response('', {
    status: 204,
    headers,
  });
}

/**
 * Apply CORS headers to response
 */
export function applyCorsHeaders(
  response: Response,
  request: Request,
  config: ApiConfig
): Response {
  const corsHeaders = getCorsHeaders(request, config);
  const headers = new Headers(response.headers);

  // Apply CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
