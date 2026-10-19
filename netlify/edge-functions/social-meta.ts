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

// Chart screenshots still render on Fly (they need headless Chromium);
// social cards are served same-origin by the social-cards Netlify Function
// behind durable CDN caching.
const CHARTS_BASE = 'https://contributor-info-social-cards.fly.dev';

// The Fly app scales to zero and takes ~17 s cold, so crawlers are pointed
// at the rendered PNG in the public `chart-screenshots` bucket whenever one
// exists and is fresh. Only a miss sends the crawler to Fly. The object path
// and TTL mirror `generateCacheKey` / `CACHE_TTL` in
// fly-social-cards/src/cache.js; change both together.
const CHART_STORAGE_BUCKET = 'chart-screenshots';
const CHART_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;
const CHART_STORAGE_CHECK_TIMEOUT_MS = 1500;
// Fly's route only accepts these characters for owner/repo, so anything
// else cannot have a cached object and goes straight to Fly (which 400s).
const CHART_PARAM_PATTERN = /^[a-zA-Z0-9_.-]{1,100}$/;

interface ChartImage {
  apiChartType: string;
  owner: string;
  repo: string;
}

function chartStoragePath({ apiChartType, owner, repo }: ChartImage): string {
  // Defaults match the Fly route: timeRange=30, type=donut.
  return `${apiChartType}/${owner.toLowerCase()}/${repo.toLowerCase()}/30-donut.png`;
}

function chartFlyUrl({ apiChartType, owner, repo }: ChartImage): string {
  return `${CHARTS_BASE}/charts/${apiChartType}?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
}

function chartStorageUrl(chart: ChartImage): string | null {
  const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return null;
  if (!CHART_PARAM_PATTERN.test(chart.owner) || !CHART_PARAM_PATTERN.test(chart.repo)) {
    return null;
  }
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${CHART_STORAGE_BUCKET}/${chartStoragePath(chart)}`;
}

function isFresh(lastModified: string | null): boolean {
  if (!lastModified) return false;
  const modifiedAt = Date.parse(lastModified);
  if (Number.isNaN(modifiedAt)) return false;
  return Date.now() - modifiedAt <= CHART_STORAGE_TTL_MS;
}

/**
 * Cached storage object if present and fresh, else the Fly render URL.
 * Any failure of the HEAD check (timeout, network, 4xx) falls back to Fly,
 * so a storage outage degrades to today's behaviour rather than no image.
 */
async function resolveChartImage(chart: ChartImage): Promise<string> {
  const storageUrl = chartStorageUrl(chart);
  const flyUrl = chartFlyUrl(chart);
  if (!storageUrl) return flyUrl;

  try {
    const response = await fetch(storageUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(CHART_STORAGE_CHECK_TIMEOUT_MS),
    });
    const fresh = response.ok && isFresh(response.headers.get('last-modified'));
    addBreadcrumb({
      message: fresh ? 'Chart image served from storage cache' : 'Chart image cache miss',
      category: 'social-meta',
      level: 'info',
      data: { status: response.status, path: chartStoragePath(chart) },
    });
    return fresh ? storageUrl : flyUrl;
  } catch (error) {
    addBreadcrumb({
      message: 'Chart storage check failed, falling back to Fly',
      category: 'social-meta',
      level: 'warning',
      data: { error: error instanceof Error ? error.message : String(error) },
    });
    return flyUrl;
  }
}

function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot));
}

interface MetaTags {
  title: string;
  description: string;
  image: string;
  // Set for chart pages; the handler resolves it to storage or Fly.
  chart?: ChartImage;
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

function getMetaTagsForPath(pathname: string, origin: string): MetaTags {
  // Remove trailing slash
  const path = pathname.replace(/\/$/, '') || '/';

  // Home page
  if (path === '/') {
    return {
      title: 'contributor.info - Visualizing Open Source Contributions',
      description:
        'Discover and visualize GitHub contributors. Track open source activity and analyze contribution patterns.',
      image: `${origin}/social-cards/home`,
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
    'spam',
  ];

  // Check if first segment is reserved
  const firstSegment = path.split('/')[1];
  if (reservedPaths.includes(firstSegment)) {
    return {
      title: 'contributor.info - Visualizing Open Source Contributions',
      description:
        'Discover and visualize GitHub contributors. Track open source activity and analyze contribution patterns.',
      image: `${origin}/social-cards/home`,
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
      const chart: ChartImage = { apiChartType, owner, repo };
      return {
        title: `${chartMeta.title} - ${owner}/${repo} - contributor.info`,
        description: `${chartMeta.description} for ${owner}/${repo} on GitHub.`,
        image: chartFlyUrl(chart),
        chart,
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
        image: `${origin}/social-cards/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
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
        image: `${origin}/social-cards/user?username=${encodeURIComponent(username)}`,
      };
    }
  }

  // Default fallback
  return {
    title: 'contributor.info - Visualizing Open Source Contributions',
    description: 'Discover and visualize GitHub contributors.',
    image: `${origin}/social-cards/home`,
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
  const meta = getMetaTagsForPath(url.pathname, url.origin);
  if (meta.chart) {
    meta.image = await resolveChartImage(meta.chart);
  }

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
    // Update og:image (replace only the first tag — the static fallback stays)
    .replace(
      /<meta property="og:image" content="[^"]*"/,
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
      /<meta property="twitter:image" content="[^"]*"/,
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
    '/social-cards/*',
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
