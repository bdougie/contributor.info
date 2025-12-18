/**
 * HTML Template utilities for Edge SSR
 *
 * Generates the HTML shell that matches the SPA structure for seamless hydration.
 * The client-side React app will hydrate the SSR content without a full re-render.
 */

import { html, SafeHTML, escapeHtml, unsafe } from './safe-html.ts';
import { CRITICAL_CSS } from './critical-css.ts';

// Re-export escapeHtml for backward compatibility if needed, though usage should migrate to safe-html
export { escapeHtml };
// Re-export types used by other files
export type { SafeHTML };
export { html, unsafe };

const SOCIAL_CARDS_BASE = 'https://contributor-info-social-cards.fly.dev';

export interface MetaTags {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
}

/**
 * Type-safe SSR data structures for each route
 */
export interface HomePageData {
  totalRepos: number;
  totalContributors: number;
  totalPRs: number;
}

export interface TrendingPageData {
  repos: Array<{
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string | null;
    stargazer_count: number;
    fork_count: number;
    language: string | null;
    topics: string[] | null;
    score: number;
  }>;
}

export interface RepoPageData {
  owner: string;
  repo: string;
  repository: {
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string | null;
    stargazer_count: number;
    fork_count: number;
    language: string | null;
    topics: string[] | null;
    updated_at: string;
  };
  contributorStats: {
    count: number;
    topContributors: Array<{
      login: string;
      avatar_url: string;
      contributions: number;
    }>;
  };
}

export interface WorkspacesPageData {
  authenticated: boolean;
  workspaces?: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    repository_count: number;
    member_count: number;
    repositories: Array<{
      id: string;
      full_name: string;
      name: string;
      owner: string;
      language: string | null;
      stargazer_count: number;
    }>;
  }>;
  stats?: {
    totalWorkspaces: number;
    totalRepositories: number;
  };
}

export interface WorkspaceDetailPageData {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    tier: string;
    owner_id: string;
    created_at: string;
    is_public: boolean;
    repository_count: number;
    member_count: number;
    contributor_count: number;
    repositories: Array<{
      id: string;
      full_name: string;
      name: string;
      owner: string;
      description: string | null;
      language: string | null;
      stargazer_count: number;
    }>;
    owner: {
      id: string;
      github_username: string | null;
      avatar_url: string | null;
    } | null;
  } | null;
}

/**
 * Discriminated union for type-safe SSR data
 * Note: RepoPageData can be null when data fetch fails (shows skeleton)
 */
export type SSRData =
  | { route: 'home'; data: HomePageData; timestamp: number }
  | { route: 'trending'; data: TrendingPageData; timestamp: number }
  | { route: 'workspaces'; data: WorkspacesPageData; timestamp: number }
  | { route: 'workspace-detail'; data: WorkspaceDetailPageData; timestamp: number }
  | { route: string; data: RepoPageData | null; timestamp: number };

export interface AssetReferences {
  scripts: string[];
  modulePreloads: string[];
  stylesheets: string[];
  /** When true, asset fetching failed and page should fall back to SPA */
  fallbackToSPA: boolean;
}

// Cache for asset references (lives for the duration of the edge function instance)
let cachedAssets: AssetReferences | null = null;

/**
 * Fetch and parse index.html to extract asset references
 * This ensures SSR pages use the same hashed assets as the SPA
 */
export async function getAssetReferences(baseUrl: string): Promise<AssetReferences> {
  // Return cached assets if available
  if (cachedAssets) {
    return cachedAssets;
  }

  try {
    // Fetch the actual index.html from the origin
    const response = await fetch(`${baseUrl}/index.html`, {
      headers: {
        // Bypass edge functions to get the static file
        'x-bypass-edge': 'true',
      },
    });

    if (!response.ok) {
      console.error('[SSR] Failed to fetch index.html:', response.status);
      return getSPAFallback();
    }

    const htmlContent = await response.text();

    // Extract script tags with src attribute
    const scriptMatches = htmlContent.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g);
    const scripts: string[] = [];
    for (const match of scriptMatches) {
      if (match[1] && !match[1].includes('netlify')) {
        scripts.push(match[1]);
      }
    }

    // Extract modulepreload links
    const preloadMatches = htmlContent.matchAll(
      /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"[^>]*>/g
    );
    const modulePreloads: string[] = [];
    for (const match of preloadMatches) {
      if (match[1]) {
        modulePreloads.push(match[1]);
      }
    }

    // Extract stylesheet links
    const styleMatches = htmlContent.matchAll(
      /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g
    );
    const stylesheets: string[] = [];
    for (const match of styleMatches) {
      if (match[1]) {
        stylesheets.push(match[1]);
      }
    }

    // Warn if no scripts were found (likely parsing failure)
    if (scripts.length === 0) {
      console.warn('[SSR] No scripts found in index.html - parsing may have failed');
      return getSPAFallback();
    }

    cachedAssets = { scripts, modulePreloads, stylesheets, fallbackToSPA: false };
    return cachedAssets;
  } catch (error) {
    console.error('[SSR] Error fetching index.html: %o', error);
    return getSPAFallback();
  }
}

/**
 * SPA fallback when asset fetching fails
 * Signals that the page should fall back to standard SPA rendering
 */
function getSPAFallback(): AssetReferences {
  return {
    scripts: [],
    modulePreloads: [],
    stylesheets: [],
    fallbackToSPA: true,
  };
}

/**
 * Generate meta tags HTML
 */
function renderMetaTags(meta: MetaTags, url: string): SafeHTML {
  const image = meta.image || `${SOCIAL_CARDS_BASE}/social-cards/home`;
  const type = meta.type || 'website';

  return html`
    <title>${meta.title}</title>
    <meta name="description" content="${meta.description}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${type}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:title" content="${meta.title}" />
    <meta property="og:description" content="${meta.description}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:alt" content="${meta.title}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${url}" />
    <meta property="twitter:title" content="${meta.title}" />
    <meta property="twitter:description" content="${meta.description}" />
    <meta property="twitter:image" content="${image}" />
    <meta property="twitter:image:alt" content="${meta.title}" />
  `;
}

/**
 * Theme detection script - runs before render to prevent FOUC
 */
const THEME_SCRIPT = `
  (function() {
    var storageKey = 'contributor-info-theme';
    var theme = localStorage.getItem(storageKey) || 'dark';
    if (theme === 'system') {
      var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.classList.add(systemTheme);
    } else {
      document.documentElement.classList.add(theme);
    }
  })();
`;

/**
 * Generate full HTML document for SSR
 *
 * @param content - Pre-rendered HTML content for the page
 * @param meta - Meta tags for SEO
 * @param ssrData - Data to be hydrated on the client
 * @param url - Current page URL
 * @param assets - Asset references from the built index.html
 */
export function renderHTML(
  content: string | SafeHTML,
  meta: MetaTags,
  ssrData: SSRData,
  url: string,
  assets: AssetReferences
): string {
  // Generate modulepreload links
  const modulePreloads = assets.modulePreloads.map(
    (href) => html`<link rel="modulepreload" crossorigin href="${href}" />`
  );
  // We can join SafeHTML arrays with html`` or just join them since html tag handles arrays
  // But since map returns SafeHTML[], we can use them in html tag
  // Generate stylesheet links
  const stylesheets = assets.stylesheets.map(
    (href) => html`<link rel="stylesheet" crossorigin href="${href}" />`
  );

  // Generate script tags
  const scripts = assets.scripts.map(
    (src) => html`<script type="module" crossorigin src="${src}"></script>`
  );

  // Allow content to be SafeHTML or string (if string, it's assumed to be already safe or will be wrapped)
  // But wait, if content is string, we should assume it's pre-rendered HTML (unsafe to escape, but needs to be marked safe)
  // In our case, content comes from renderHomeContent which will return SafeHTML or string.
  // If it returns string, it might be raw HTML.
  // We should enforce SafeHTML for content.
  const safeContent = typeof content === 'string' ? unsafe(content) : content;

  // Serialize data safely for script injection
  // 1. Stringify the data
  const json = JSON.stringify(ssrData);
  // 2. Escape < to \u003c to prevent </script> injection
  const safeJson = json.replace(/</g, '\\u003c');
  // 3. Double-stringify to get a string literal for JSON.parse("...")
  // This ensures that special characters in the string (like backslashes) are properly escaped for the JS string literal
  const quotedSafeJson = JSON.stringify(safeJson);

  return html`<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        ${renderMetaTags(meta, url)}

        <!-- PWA Configuration -->
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Contributors" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />

        <!-- SEO -->
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Brian Douglas" />
        <link rel="canonical" href="${url}" />

        <!-- Performance -->
        <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
        <link rel="dns-prefetch" href="https://egcxzonpmmcirmgqdrla.supabase.co" />

        <!-- Theme detection - prevent FOUC -->
        <script>
          ${unsafe(THEME_SCRIPT)};
        </script>

        <!-- Critical CSS -->
        <style>
          ${unsafe(CRITICAL_CSS)}
        </style>

        <!-- SSR Data for hydration (double-stringify prevents XSS via script injection) -->
        <script>
          window.__SSR_DATA__ = JSON.parse(${unsafe(quotedSafeJson)});
        </script>

        <!-- Modulepreload for critical chunks -->
        ${modulePreloads}

        <!-- Stylesheets -->
        ${stylesheets}
      </head>
      <body>
        <div id="root">${safeContent}</div>
        ${scripts}
      </body>
    </html>`.content;
}

/**
 * Generate response headers for SSR pages
 * @param cacheMaxAge - Max age for CDN cache in seconds
 * @param staleWhileRevalidate - Stale-while-revalidate window in seconds
 * @param isPrivate - If true, use private cache (for authenticated content)
 */
export function getSSRHeaders(
  cacheMaxAge = 60,
  staleWhileRevalidate = 300,
  isPrivate = false
): Headers {
  const cacheControl = isPrivate
    ? `private, max-age=${cacheMaxAge}`
    : `public, s-maxage=${cacheMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': cacheControl,
    'X-SSR-Rendered': 'true',
    'X-Robots-Tag': 'index, follow',
  });

  // Add Vary header for authenticated content to prevent cache poisoning
  if (isPrivate) {
    headers.set('Vary', 'Cookie');
  }

  return headers;
}
