import { Handler, HandlerEvent } from '@netlify/functions';

const DUB_API_KEY = process.env.VITE_DUB_CO_KEY;
const DUB_API_BASE = 'https://api.dub.co';

interface CreateShortUrlRequest {
  url: string;
  key?: string;
  title?: string;
  description?: string;
  expiresAt?: string;
  rewrite?: boolean;
}

interface DubResponse {
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

export const handler: Handler = async (event: HandlerEvent) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Check if API key is configured
  if (!DUB_API_KEY) {
    console.warn('VITE_DUB_CO_KEY not configured');
    return {
      statusCode: 503,
      body: JSON.stringify({
        error: 'Dub.co API key not configured',
        fallback: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    const body: CreateShortUrlRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL is required' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Validate URL for security
    const urlObj = new URL(body.url);
    const allowedHosts = ['contributor.info', 'localhost', 'netlify.app'];

    const isAllowed = allowedHosts.some(
      (host) => urlObj.host === host || urlObj.host.endsWith(`.${host}`)
    );

    if (!isAllowed) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Invalid URL domain' }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Skip URL shortening for deploy previews - Dub.co flags these URLs as "malicious"
    // because the deploy-preview-XXX pattern looks suspicious to their security filters
    const isDeployPreview = process.env.CONTEXT === 'deploy-preview';
    if (isDeployPreview) {
      console.log(
        'Deploy preview detected, skipping URL shortening (Dub flags these as malicious)'
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          id: 'deploy-preview-skip',
          domain: urlObj.host,
          key: urlObj.pathname,
          url: body.url,
          shortLink: body.url, // Return original URL
          qrCode: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clicks: 0,
          title: body.title || null,
          description: body.description || null,
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Determine domain based on environment
    const isDev = process.env.CONTEXT !== 'production';
    const domain = isDev ? 'dub.sh' : 'oss.fyi';

    console.log('Creating short URL via Dub API:', {
      url: body.url,
      domain,
      key: body.key,
    });

    // Call Dub.co API
    const response = await fetch(`${DUB_API_BASE}/links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: body.url,
        domain,
        key: body.key,
        title: body.title,
        description: body.description,
        expiresAt: body.expiresAt,
        rewrite: body.rewrite,
        utmSource: 'contributor-info',
        utmMedium: 'chart-share',
        utmCampaign: 'social-sharing',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Dub API error:', {
        status: response.status,
        error: errorText,
      });

      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: 'Failed to create short URL',
          details: errorText,
        }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    const data: DubResponse = await response.json();

    console.log('Short URL created successfully:', data.shortLink);

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error('Error creating short URL:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
