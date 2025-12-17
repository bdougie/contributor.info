/**
 * HTML Template utilities for Edge SSR
 *
 * Generates the HTML shell that matches the SPA structure for seamless hydration.
 * The client-side React app will hydrate the SSR content without a full re-render.
 */

const SOCIAL_CARDS_BASE = 'https://contributor-info-social-cards.fly.dev';

export interface MetaTags {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: string;
}

// Define specific types for each route's SSR data
export interface HomeSSRData {
  stats: {
    totalRepos: number;
    totalContributors: number;
    totalPRs: number;
  };
}

export interface TrendingSSRData {
  repositories: Array<{
    id: number;
    owner: string;
    name: string;
    full_name: string;
    description: string | null;
    stargazer_count: number;
    fork_count: number;
    primary_language: string | null;
    topics: string[];
    score: number;
  }>;
}

export interface RepoSSRData {
  owner: string;
  repo: string;
  repository: {
    id: number;
    full_name: string;
    description: string | null;
    stargazer_count: number;
    fork_count: number;
    primary_language: string | null;
    topics: string[];
  };
  contributors: Array<{
    login: string;
    avatar_url: string;
    contributions: number;
  }>;
  stats: {
    totalContributors: number;
    totalPRs: number;
  };
}

// Discriminated union for type-safe SSR data
export type SSRData =
  | { route: '/'; data: HomeSSRData; timestamp: number }
  | { route: '/trending'; data: TrendingSSRData; timestamp: number }
  | { route: string; data: RepoSSRData; timestamp: number };

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely serialize JSON for embedding in HTML <script> tags
 * Escapes </script>, <!--, and other dangerous sequences that could break out of the script context
 * 
 * @param data - The data to serialize
 * @returns HTML-safe JSON string
 */
function serializeJSONForHTML(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')  // Escape < to prevent </script>
    .replace(/>/g, '\\u003e')  // Escape > for consistency
    .replace(/&/g, '\\u0026')  // Escape & to prevent HTML entities
    .replace(/\u2028/g, '\\u2028')  // Escape Unicode line separator
    .replace(/\u2029/g, '\\u2029'); // Escape Unicode paragraph separator
}

/**
 * Generate meta tags HTML
 */
function renderMetaTags(meta: MetaTags, url: string): string {
  const safeTitle = escapeHtml(meta.title);
  const safeDescription = escapeHtml(meta.description);
  const safeImage = escapeHtml(meta.image || `${SOCIAL_CARDS_BASE}/social-cards/home`);
  const safeUrl = escapeHtml(url);

  return `
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${meta.type || 'website'}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTitle}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${safeUrl}" />
    <meta property="twitter:title" content="${safeTitle}" />
    <meta property="twitter:description" content="${safeDescription}" />
    <meta property="twitter:image" content="${safeImage}" />
    <meta property="twitter:image:alt" content="${safeTitle}" />
  `;
}

/**
 * Critical CSS inlined for instant rendering
 * Matches the styles from index.html
 */
const CRITICAL_CSS = `
  *,::before,::after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e5e7eb}
  ::before,::after{--tw-content:''}
  html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;tab-size:4;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-feature-settings:normal;font-variation-settings:normal;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
  body{margin:0;line-height:inherit;font-display:swap}
  :root{--background:210 20% 98%;--foreground:215 25% 27%;--card:0 0% 100%;--card-foreground:215 25% 27%;--primary:14 100% 50%;--primary-foreground:0 0% 100%;--secondary:210 20% 94%;--secondary-foreground:215 25% 27%;--muted:210 20% 94%;--muted-foreground:215 16% 47%;--border:220 13% 91%;--input:210 20% 96%;--ring:14 100% 50%;--radius:0.5rem}
  .dark{--background:0 0% 3.9%;--foreground:0 0% 98%;--card:0 0% 3.9%;--card-foreground:0 0% 98%;--primary:14 100% 50%;--primary-foreground:0 0% 100%;--secondary:0 0% 14.9%;--secondary-foreground:0 0% 98%;--muted:0 0% 14.9%;--muted-foreground:0 0% 63.9%;--border:0 0% 14.9%;--input:0 0% 14.9%;--ring:14 100% 50%}
  .min-h-screen{min-height:100vh}.flex{display:flex}.flex-col{flex-direction:column}.items-center{align-items:center}.justify-center{justify-content:center}.bg-background{background-color:hsl(var(--background))}.bg-muted{background-color:hsl(var(--muted))}.text-foreground{color:hsl(var(--foreground))}.border-b{border-bottom-width:1px;border-color:hsl(var(--border))}.animate-pulse{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  body{background-color:hsl(var(--background));color:hsl(var(--foreground))}
  #root{min-height:100vh;background-color:hsl(var(--background))}
  .container{width:100%;margin-left:auto;margin-right:auto;padding-left:1rem;padding-right:1rem;max-width:1280px}
  .text-center{text-align:center}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}.text-4xl{font-size:2.25rem;line-height:2.5rem}
  .font-bold{font-weight:700}.font-semibold{font-weight:600}
  .text-muted-foreground{color:hsl(var(--muted-foreground))}.text-primary{color:hsl(var(--primary))}
  .mb-2{margin-bottom:0.5rem}.mb-4{margin-bottom:1rem}.mb-8{margin-bottom:2rem}.mt-4{margin-top:1rem}.mt-8{margin-top:2rem}
  .p-4{padding:1rem}.p-6{padding:1.5rem}.py-8{padding-top:2rem;padding-bottom:2rem}.py-12{padding-top:3rem;padding-bottom:3rem}
  .gap-4{gap:1rem}.gap-6{gap:1.5rem}
  .grid{display:grid}.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}
  @media(min-width:768px){.md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.md\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}
  .rounded-lg{border-radius:0.5rem}.rounded-full{border-radius:9999px}
  .border{border-width:1px;border-color:hsl(var(--border))}.bg-card{background-color:hsl(var(--card))}.shadow-sm{box-shadow:0 1px 2px 0 rgb(0 0 0 / 0.05)}
  .w-full{width:100%}.h-10{height:2.5rem}.h-12{height:3rem}.w-10{width:2.5rem}.w-12{width:3rem}
  .overflow-hidden{overflow:hidden}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .space-y-2>:not([hidden])~:not([hidden]){margin-top:0.5rem}.space-y-4>:not([hidden])~:not([hidden]){margin-top:1rem}
  a{color:inherit;text-decoration:inherit}
  .hover\\:underline:hover{text-decoration-line:underline}
`;

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
 */
export function renderHTML(content: string, meta: MetaTags, ssrData: SSRData, url: string): string {
  return `<!DOCTYPE html>
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
    <link rel="canonical" href="${escapeHtml(url)}" />

    <!-- Performance -->
    <link rel="dns-prefetch" href="https://avatars.githubusercontent.com">
    <link rel="dns-prefetch" href="https://egcxzonpmmcirmgqdrla.supabase.co">

    <!-- Theme detection - prevent FOUC -->
    <script>${THEME_SCRIPT}</script>

    <!-- Critical CSS -->
    <style>${CRITICAL_CSS}</style>

    <!-- SSR Data for hydration - HTML-safe serialization to prevent XSS -->
    <script>window.__SSR_DATA__ = ${serializeJSONForHTML(ssrData)};</script>
  </head>
  <body>
    <div id="root">${content}</div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

/**
 * Generate response headers for SSR pages
 */
export function getSSRHeaders(cacheMaxAge = 60, staleWhileRevalidate = 300): Headers {
  return new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': `public, s-maxage=${cacheMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
    'X-SSR-Rendered': 'true',
    'X-Robots-Tag': 'index, follow',
  });
}
