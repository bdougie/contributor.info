import type { Context } from '@netlify/edge-functions';

const CRAWLER_USER_AGENTS = [
  'twitterbot',
  'facebookexternalhit',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'telegrambot',
  'whatsapp',
  'pinterest',
  'googlebot',
  'bingbot',
  'applebot',
];

const SOCIAL_CARDS_BASE = 'https://contributor-info-social-cards.fly.dev';

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot));
}

interface MetaTags {
  title: string;
  description: string;
  image: string;
}

function getMetaTagsForPath(pathname: string): MetaTags {
  // Remove trailing slash
  const path = pathname.replace(/\/$/, '') || '/';

  // Home page
  if (path === '/') {
    return {
      title: 'contributor.info - Visualizing Open Source Contributions',
      description:
        'Discover and visualize GitHub contributors. Track open source activity and analyze contribution patterns.',
      image: `${SOCIAL_CARDS_BASE}/social-cards/home`,
    };
  }

  // Reserved paths that should use home card
  const reservedPaths = [
    'feed',
    'login',
    'callback',
    'dev',
    'widgets',
    'changelog',
    'api',
    'auth',
    'privacy',
    'terms',
  ];

  // Check if first segment is reserved
  const firstSegment = path.split('/')[1];
  if (reservedPaths.includes(firstSegment)) {
    return {
      title: 'contributor.info - Visualizing Open Source Contributions',
      description:
        'Discover and visualize GitHub contributors. Track open source activity and analyze contribution patterns.',
      image: `${SOCIAL_CARDS_BASE}/social-cards/home`,
    };
  }

  // Repo page: /{owner}/{repo} or /{owner}/{repo}/anything
  const repoMatch = path.match(/^\/([^/]+)\/([^/]+)(?:\/.*)?$/);
  if (repoMatch) {
    const [, owner, repo] = repoMatch;
    // Validate owner/repo names (basic validation)
    if (owner && repo && !owner.includes('?') && !repo.includes('?')) {
      return {
        title: `${owner}/${repo} Contributors - contributor.info`,
        description: `Explore contributors and contribution patterns for ${owner}/${repo} on GitHub.`,
        image: `${SOCIAL_CARDS_BASE}/social-cards/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      };
    }
  }

  // User/Org page: /{username} (single segment)
  const userMatch = path.match(/^\/([^/]+)$/);
  if (userMatch) {
    const username = userMatch[1];
    // Validate username (no query params, reasonable length)
    if (username && !username.includes('?') && username.length > 0 && username.length < 100) {
      return {
        title: `${username} - contributor.info`,
        description: `View ${username}'s open source contributions and activity on GitHub.`,
        image: `${SOCIAL_CARDS_BASE}/social-cards/user?username=${encodeURIComponent(username)}`,
      };
    }
  }

  // Default fallback
  return {
    title: 'contributor.info - Visualizing Open Source Contributions',
    description: 'Discover and visualize GitHub contributors.',
    image: `${SOCIAL_CARDS_BASE}/social-cards/home`,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(request: Request, context: Context) {
  const userAgent = request.headers.get('user-agent');

  // Non-crawlers get normal SPA
  if (!isCrawler(userAgent)) {
    return context.next();
  }

  // Get the original response
  const response = await context.next();
  const contentType = response.headers.get('content-type');

  // Only modify HTML responses
  if (!contentType || !contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();

  // Parse URL
  const url = new URL(request.url);
  const meta = getMetaTagsForPath(url.pathname);

  // Escape values for safe HTML injection
  const safeTitle = escapeHtml(meta.title);
  const safeDescription = escapeHtml(meta.description);
  const safeImage = escapeHtml(meta.image);
  const safeUrl = escapeHtml(request.url);

  // Replace meta tags in HTML
  const modifiedHtml = html
    // Update page title
    .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
    // Update og:title
    .replace(
      /<meta property="og:title" content="[^"]*"/,
      `<meta property="og:title" content="${safeTitle}"`
    )
    // Update og:description
    .replace(
      /<meta property="og:description" content="[^"]*"/,
      `<meta property="og:description" content="${safeDescription}"`
    )
    // Update og:image (Fly.io URL)
    .replace(
      /<meta property="og:image" content="https:\/\/contributor-info-social-cards\.fly\.dev[^"]*"/,
      `<meta property="og:image" content="${safeImage}"`
    )
    // Update og:url
    .replace(
      /<meta property="og:url" content="[^"]*"/,
      `<meta property="og:url" content="${safeUrl}"`
    )
    // Update twitter:title
    .replace(
      /<meta property="twitter:title" content="[^"]*"/,
      `<meta property="twitter:title" content="${safeTitle}"`
    )
    // Update twitter:description
    .replace(
      /<meta property="twitter:description" content="[^"]*"/,
      `<meta property="twitter:description" content="${safeDescription}"`
    )
    // Update twitter:image
    .replace(
      /<meta property="twitter:image" content="https:\/\/contributor-info-social-cards\.fly\.dev[^"]*"/,
      `<meta property="twitter:image" content="${safeImage}"`
    )
    // Update twitter:url
    .replace(
      /<meta property="twitter:url" content="[^"]*"/,
      `<meta property="twitter:url" content="${safeUrl}"`
    )
    // Update meta description
    .replace(
      /<meta name="description" content="[^"]*"/,
      `<meta name="description" content="${safeDescription}"`
    );

  return new Response(modifiedHtml, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      'content-type': 'text/html; charset=utf-8',
      'x-social-meta-injected': 'true',
      'x-crawler-detected': userAgent?.substring(0, 50) || 'unknown',
    },
  });
}

export const config = {
  path: '/*',
  excludedPath: [
    '/api/*',
    '/_next/*',
    '/assets/*',
    '/*.js',
    '/*.css',
    '/*.svg',
    '/*.png',
    '/*.webp',
    '/*.ico',
    '/*.json',
    '/*.xml',
    '/*.txt',
    '/icons/*',
    '/docs/*',
  ],
};
