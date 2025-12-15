import type { Context } from '@netlify/edge-functions';
import { withSentry, addBreadcrumb, captureMessage } from './_shared/sentry.ts';

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

// Chart type mappings for social meta
const CHART_TYPE_META: Record<string, { title: string; description: string }> = {
  'lottery-factor': {
    title: 'Lottery Factor',
    description: 'Contributor concentration risk analysis',
  },
  'self-selection': {
    title: 'Self-Selection Rate',
    description: 'External vs internal contribution analysis',
  },
  health: {
    title: 'Repository Health',
    description: 'Health metrics and factors analysis',
  },
  distribution: {
    title: 'PR Distribution',
    description: 'Pull request size distribution analysis',
  },
};

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

  // Chart page: /{owner}/{repo}/{chartType}
  const chartMatch = path.match(
    /^\/([^/]+)\/([^/]+)\/(lottery-factor|self-selection|health|distribution)$/
  );
  if (chartMatch) {
    const [, owner, repo, chartType] = chartMatch;
    if (owner && repo && !owner.includes('?') && !repo.includes('?')) {
      const chartMeta = CHART_TYPE_META[chartType] || {
        title: 'Chart',
        description: 'Repository analysis',
      };
      // Map 'health' to 'health-factors' for the API
      const apiChartType = chartType === 'health' ? 'health-factors' : chartType;
      return {
        title: `${chartMeta.title} - ${owner}/${repo} - contributor.info`,
        description: `${chartMeta.description} for ${owner}/${repo} on GitHub.`,
        image: `${SOCIAL_CARDS_BASE}/charts/${apiChartType}?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      };
    }
  }

  // Repo page: /{owner}/{repo} or /{owner}/{repo}/anything (except chart types)
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

async function handler(request: Request, context: Context) {
  const userAgent = request.headers.get('user-agent');

  // Non-crawlers get normal SPA
  if (!isCrawler(userAgent)) {
    return context.next();
  }

  // Track crawler detection
  addBreadcrumb({
    message: 'Crawler detected',
    category: 'social-meta',
    level: 'info',
    data: {
      userAgent: userAgent?.substring(0, 100),
    },
  });

  // Get the original response
  const response = await context.next();
  const contentType = response.headers.get('content-type');

  // Only modify HTML responses
  if (!contentType || !contentType.includes('text/html')) {
    addBreadcrumb({
      message: 'Non-HTML response, skipping meta injection',
      category: 'social-meta',
      level: 'info',
      data: { contentType },
    });
    return response;
  }

  const html = await response.text();

  // Parse URL
  const url = new URL(request.url);
  const meta = getMetaTagsForPath(url.pathname);

  // Track which meta tags are being generated
  addBreadcrumb({
    message: 'Generating meta tags',
    category: 'social-meta',
    level: 'info',
    data: {
      pathname: url.pathname,
      title: meta.title,
      image: meta.image,
    },
  });

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

  // Verify HTML was modified (basic check)
  if (modifiedHtml === html) {
    captureMessage('Meta tags not replaced - HTML structure may have changed', 'warning', {
      pathname: url.pathname,
      htmlLength: html.length,
    });
  }

  return new Response(modifiedHtml, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers),
      'content-type': 'text/html; charset=utf-8',
      'x-social-meta-injected': 'true',
      'x-crawler-detected': 'true',
    },
  });
}

export default withSentry('social-meta', handler);

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
