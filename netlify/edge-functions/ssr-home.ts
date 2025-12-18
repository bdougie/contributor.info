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
import { shouldSSR, fallbackToSPA } from './_shared/ssr-utils.ts';

/**
 * Example repositories to show on the home page
 * These are rendered server-side for immediate visibility
 * Must match src/components/features/repository/example-repos.tsx
 */
const EXAMPLE_REPOS = [
  'continuedev/continue',
  'argoproj/argo-cd',
  'TanStack/table',
  'vitejs/vite',
  'etcd-io/etcd',
  'better-auth/better-auth',
];

/**
 * Render the home page HTML content
 */
function renderHomeContent(): string {
  // Button styles matching variant="outline" size="sm"
  const buttonClass = "inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs sm:text-sm";

  const exampleReposHtml = EXAMPLE_REPOS.map(
    (repo) => `
      <button
        type="button"
        class="${buttonClass}"
        onclick="window.location.href='/${escapeHtml(repo)}'"
      >
        ${escapeHtml(repo)}
      </button>
    `
  ).join('');

  // Search button styles matching the client-side override (white button)
  const searchButtonClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-white text-black border border-gray-300 shadow-sm hover:bg-gray-100";

  // Login button styles matching variant="outline"
  const loginButtonClass = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2";

  return `
    <div class="min-h-screen bg-background flex flex-col">
      <header class="border-b">
        <div class="container flex h-16 items-center px-4">
          <div class="flex items-center space-x-4">
            <button class="p-2 hover:bg-muted rounded-md transition-colors" aria-label="Open menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
                <path d="M4 12h16M4 18h16M4 6h16"/>
              </svg>
            </button>
            <button onclick="window.location.href='/'" class="text-xl font-bold hover:text-primary transition-colors">
              contributor.info
            </button>
          </div>
          <div class="ml-auto flex items-center gap-2">
            <button type="button" class="${loginButtonClass}" onclick="window.location.href='/login'">
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-4 w-4 hidden sm:inline-block">
                 <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65S8.93 17.38 9 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>
               </svg>
               <span class="hidden sm:inline">Login with GitHub</span>
               <span class="sm:hidden">Login</span>
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1 bg-muted/50 dark:bg-black">
        <div class="container px-4 py-6">
          <article class="flex items-center justify-center min-h-[calc(100vh-8rem)]">
            <div class="w-full max-w-2xl space-y-6">
              <!-- Hero Card -->
              <div class="rounded-lg border bg-card shadow-sm text-card-foreground">
                <div class="flex flex-col space-y-1.5 p-6">
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
                    <div class="relative">
                      <form class="flex gap-4" onsubmit="event.preventDefault();">
                        <div class="flex-1 relative">
                          <input
                            type="text"
                            placeholder="Search repositories (e.g., facebook/react)"
                            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full pr-8"
                            id="ssr-search-input"
                            autocomplete="off"
                          />
                        </div>
                        <button
                          type="submit"
                          class="${searchButtonClass}"
                          id="ssr-search-button"
                          aria-label="Analyze"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2 h-4 w-4">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                          </svg>
                          Analyze
                        </button>
                      </form>
                    </div>
                  </section>
                  <!-- Example Repos -->
                  <aside class="mt-4 w-full">
                    <div class="text-sm text-muted-foreground mb-2">Popular examples:</div>
                    <div class="flex flex-wrap gap-2">
                      ${exampleReposHtml}
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>

      <footer class="border-t py-4">
        <div class="container px-4 text-center text-sm text-muted-foreground">
          Made with ❤️ by <a href="https://github.com/bdougie" target="_blank" rel="noopener noreferrer" class="hover:text-primary transition-colors">bdougie</a>
        </div>
      </footer>
    </div>

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
              } else {
                // Just navigate to the value if it looks like owner/repo
                if (value.includes('/')) {
                   window.location.href = '/' + value;
                }
              }
            }
          }
          button.addEventListener('click', function(e) {
            e.preventDefault();
            handleSearch();
          });
          input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          });
        }
      })();
    </script>
  `;
}

async function handler(request: Request, context: Context) {
  const url = new URL(request.url);
  console.log(`[ssr-home] Handling request for ${url.pathname}`);

  // Only handle exact root path
  if (url.pathname !== '/') {
    console.log(`[ssr-home] Ignoring non-root path: ${url.pathname}`);
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
    // Fetch asset references
    const baseUrl = `${url.protocol}//${url.host}`;
    const assets = await getAssetReferences(baseUrl);

    // Fall back to SPA if assets couldn't be loaded
    if (assets.fallbackToSPA) {
      console.warn('[ssr-home] Asset loading failed, falling back to SPA');
      return fallbackToSPA(context);
    }

    // Generate the page content
    const content = renderHomeContent();

    const meta: MetaTags = {
      title: 'contributor.info - Visualizing Open Source Contributions',
      description:
        'Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact.',
      image: 'https://contributor-info-social-cards.fly.dev/social-cards/home',
    };

    // Default empty stats for hydration compatibility (since we removed stats fetch)
    const stats: HomePageData = {
      totalRepos: 0,
      totalContributors: 0,
      totalPRs: 0
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
