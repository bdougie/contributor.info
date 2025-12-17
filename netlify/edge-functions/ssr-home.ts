/**
 * Edge SSR for Home Page
 *
 * Renders the landing page with pre-rendered HTML for better LCP.
 * The client will hydrate this content and add interactive features.
 */

import type { Context } from '@netlify/edge-functions';
import { withSentry, addBreadcrumb } from './_shared/sentry.ts';
import {
  renderHTML,
  getSSRHeaders,
  escapeHtml,
  getAssetReferences,
  type MetaTags,
  type HomePageData,
} from './_shared/html-template.ts';
import { fetchHomeStats } from './_shared/supabase.ts';
import { formatNumber, shouldSSR, fallbackToSPA } from './_shared/ssr-utils.ts';

/**
 * Example repositories to show on the home page
 * These are rendered server-side for immediate visibility
 */
const EXAMPLE_REPOS = [
  { name: 'facebook/react', label: 'React' },
  { name: 'vercel/next.js', label: 'Next.js' },
  { name: 'microsoft/vscode', label: 'VS Code' },
  { name: 'denoland/deno', label: 'Deno' },
  { name: 'sveltejs/svelte', label: 'Svelte' },
  { name: 'tailwindlabs/tailwindcss', label: 'Tailwind' },
];

/**
 * Render the home page HTML content
 */
function renderHomeContent(stats: {
  totalRepos: number;
  totalContributors: number;
  totalPRs: number;
}): string {
  const exampleReposHtml = EXAMPLE_REPOS.map(
    (repo) => `
      <a
        href="/${escapeHtml(repo.name)}"
        class="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-secondary hover:bg-secondary/80 transition-colors"
      >
        ${escapeHtml(repo.label)}
      </a>
    `
  ).join('');

  return `
    <article class="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <div class="w-full max-w-2xl space-y-6 px-4">
        <!-- Hero Card -->
        <div class="rounded-lg border bg-card shadow-sm">
          <div class="p-6 pb-4">
            <h1 class="text-3xl font-bold text-center">
              Analyze GitHub Repository Contributors
            </h1>
            <p class="text-center text-lg mt-2 text-muted-foreground">
              Enter a GitHub repository URL or owner/repo to visualize contribution patterns
            </p>
          </div>
          <div class="p-6 pt-0">
            <!-- Search Input (will be hydrated by client) -->
            <section>
              <div class="flex gap-2">
                <input
                  type="text"
                  placeholder="Search repositories (e.g., facebook/react)"
                  class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  id="ssr-search-input"
                />
                <button
                  type="button"
                  class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                  id="ssr-search-button"
                >
                  Analyze
                </button>
              </div>
            </section>
            <!-- Example Repos -->
            <aside class="mt-4">
              <p class="text-sm text-muted-foreground mb-2">Try these popular repositories:</p>
              <div class="flex flex-wrap gap-2">
                ${exampleReposHtml}
              </div>
            </aside>
          </div>
        </div>

        <!-- Stats Section (shows what the platform tracks) -->
        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="rounded-lg border bg-card p-4">
            <div class="text-2xl font-bold text-primary">${formatNumber(stats.totalRepos)}</div>
            <div class="text-sm text-muted-foreground">Repositories</div>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="text-2xl font-bold text-primary">${formatNumber(stats.totalContributors)}</div>
            <div class="text-sm text-muted-foreground">Contributors</div>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="text-2xl font-bold text-primary">${formatNumber(stats.totalPRs)}</div>
            <div class="text-sm text-muted-foreground">Pull Requests</div>
          </div>
        </div>

        <!-- Login prompt placeholder (hydrated on client) -->
        <div id="ssr-auth-section"></div>
      </div>
    </article>

    <!-- Inline script for basic interactivity before hydration -->
    <script>
      (function() {
        var input = document.getElementById('ssr-search-input');
        var button = document.getElementById('ssr-search-button');
        if (input && button) {
          function handleSearch() {
            var value = input.value.trim();
            if (value) {
              var match = value.match(/(?:github\\.com\\/)?([^/]+)\\/([^/]+)/);
              if (match) {
                window.location.href = '/' + match[1] + '/' + match[2];
              }
            }
          }
          button.addEventListener('click', handleSearch);
          input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSearch();
          });
        }
      })();
    </script>
  `;
}

async function handler(request: Request, context: Context) {
  const url = new URL(request.url);

  // Only handle exact root path
  if (url.pathname !== '/') {
    return fallbackToSPA(context);
  }

  addBreadcrumb({
    message: 'SSR home page request',
    category: 'ssr',
    level: 'info',
    data: { pathname: url.pathname },
  });

  // Check if we should SSR this request
  if (!shouldSSR(request)) {
    return fallbackToSPA(context);
  }

  try {
    // Fetch stats and asset references in parallel
    const baseUrl = `${url.protocol}//${url.host}`;
    const [stats, assets] = await Promise.all([fetchHomeStats(), getAssetReferences(baseUrl)]);

    // Fall back to SPA if assets couldn't be loaded
    if (assets.fallbackToSPA) {
      console.warn('[ssr-home] Asset loading failed, falling back to SPA');
      return fallbackToSPA(context);
    }

    // Generate the page content
    const content = renderHomeContent(stats);

    const meta: MetaTags = {
      title: 'contributor.info - Visualizing Open Source Contributions',
      description:
        'Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact.',
      image: 'https://contributor-info-social-cards.fly.dev/social-cards/home',
    };

    const ssrData: { route: 'home'; data: HomePageData; timestamp: number } = {
      route: 'home',
      data: stats,
      timestamp: Date.now(),
    };

    const html = renderHTML(content, meta, ssrData, request.url, assets);
    const headers = getSSRHeaders(60, 300); // 1 min cache, 5 min stale-while-revalidate

    return new Response(html, { headers });
  } catch (error) {
    console.error('[ssr-home] Error: %o', error);
    addBreadcrumb({
      message: 'SSR home page error, falling back to SPA',
      category: 'ssr',
      level: 'error',
      data: { error: String(error) },
    });

    // Fall back to SPA on error
    return fallbackToSPA(context);
  }
}

export default withSentry('ssr-home', handler);

export const config = {
  path: '/',
};
