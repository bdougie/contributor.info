/**
 * GitHub Avatar Proxy Edge Function
 *
 * Proxies GitHub avatars to avoid CORS issues during client-side canvas capture.
 * Returns the image with proper CORS headers set.
 *
 * @example
 * GET /functions/v1/github-avatar-proxy?username=continuedev&size=48
 *
 * @returns Binary image data with CORS headers
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'public, max-age=86400',
};

function errorResponse(
  error: string,
  status: number,
  details?: string,
  code?: string
): Response {
  const body = {
    success: false,
    error,
    ...(details && { details }),
    ...(code && { code }),
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return errorResponse(
      'Method not allowed',
      405,
      'Only GET requests are supported',
      'METHOD_NOT_ALLOWED'
    );
  }

  try {
    const url = new URL(req.url);
    const username = url.searchParams.get('username');
    const size = url.searchParams.get('size') || '48';

    if (!username) {
      return errorResponse('Missing username parameter', 400, 'Username is required', 'MISSING_USERNAME');
    }

    // Validate username (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return errorResponse(
        'Invalid username',
        400,
        'Username contains invalid characters',
        'INVALID_USERNAME'
      );
    }

    // Validate size
    const sizeNum = parseInt(size, 10);
    if (isNaN(sizeNum) || sizeNum < 1 || sizeNum > 460) {
      return errorResponse('Invalid size', 400, 'Size must be between 1 and 460', 'INVALID_SIZE');
    }

    const avatarUrl = `https://avatars.githubusercontent.com/${username}?s=${sizeNum}`;

    const response = await fetch(avatarUrl, {
      headers: {
        'User-Agent': 'contributor.info-avatar-proxy/1.0',
      },
    });

    if (!response.ok) {
      return errorResponse(
        'Failed to fetch avatar',
        response.status,
        `GitHub returned ${response.status}`,
        'AVATAR_FETCH_FAILED'
      );
    }

    const contentType = response.headers.get('Content-Type') || 'image/png';
    const imageData = await response.arrayBuffer();

    return new Response(imageData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    console.error('Avatar proxy error:', error);
    return errorResponse(
      'Internal server error',
      500,
      error instanceof Error ? error.message : 'Unknown error',
      'INTERNAL_ERROR'
    );
  }
});
