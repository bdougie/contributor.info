/**
 * Edge SSR for Trending Page
 *
 * Renders the trending repositories page with pre-rendered HTML for better LCP.
 * Includes repository cards with basic data, client hydrates for interactivity.
 */

import type { Context } from '@netlify/edge-functions';
import { withSentry, addBreadcrumb } from './_shared/sentry.ts';
import {
  renderHTML,
  getSSRHeaders,
  escapeHtml,
  getAssetReferences,
  type MetaTags,
  type SSRData,
} from './_shared/html-template.ts';
import { fetchTrendingRepos, type TrendingRepo } from './_shared/supabase.ts';
import { formatNumber, shouldSSR, fallbackToSPA } from './_shared/ssr-utils.ts';

/**
 * Language colors for display
 */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Scala: '#c22d40',
  Dart: '#00B4AB',
  Shell: '#89e051',
};

/**
 * Render a single repository card
 */
function renderRepoCard(repo: TrendingRepo, isHottest = false): string {
  const languageColor = repo.language ? LANGUAGE_COLORS[repo.language] || '#858585' : '#858585';
  const description = repo.description
    ? escapeHtml(repo.description.slice(0, 150)) + (repo.description.length > 150 ? '...' : '')
    : 'No description available';

  return `
    <a href="/${escapeHtml(repo.owner)}/${escapeHtml(repo.name)}" class="block">
      <div class="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow ${isHottest ? 'border-orange-200 dark:border-orange-800' : ''}">
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="font-semibold text-lg truncate">
            <span class="text-muted-foreground">${escapeHtml(repo.owner)}/</span>${escapeHtml(repo.name)}
          </h3>
          ${isHottest ? '<span class="text-orange-500">🔥</span>' : ''}
        </div>
        <p class="text-sm text-muted-foreground mb-3 line-clamp-2">
          ${description}
        </p>
        <div class="flex items-center gap-4 text-sm">
          ${
            repo.language
              ? `
            <span class="flex items-center gap-1">
              <span class="w-3 h-3 rounded-full" style="background-color: ${languageColor}"></span>
              ${escapeHtml(repo.language)}
            </span>
          `
              : ''
          }
          <span class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/>
            </svg>
            ${formatNumber(repo.stargazer_count)}
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"/>
            </svg>
            ${formatNumber(repo.fork_count)}
          </span>
        </div>
      </div>
    </a>
  `;
}

/**
 * Render the trending page HTML content
 */
function renderTrendingContent(repos: TrendingRepo[]): string {
  if (repos.length === 0) {
    return `
      <div class="container mx-auto px-4 py-8">
        <div class="text-center py-12">
          <svg class="w-12 h-12 text-muted-foreground mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
          </svg>
          <h3 class="text-lg font-medium mb-2">No trending repositories found</h3>
          <p class="text-muted-foreground">Check back later for trending content.</p>
        </div>
      </div>
    `;
  }

  const [hottest, ...rest] = repos;

  return `
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-6 sm:mb-8">
        <div class="flex items-start sm:items-center gap-3 mb-4">
          <div class="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex-shrink-0">
            <svg class="w-5 h-5 sm:w-6 sm:h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="min-w-0">
            <h1 class="text-2xl sm:text-3xl font-bold tracking-tight">
              Trending Repositories
            </h1>
            <p class="text-sm sm:text-base text-muted-foreground hidden sm:block">
              Discover repositories with significant recent activity and growth
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary">
            ${repos.length} repos
          </span>
        </div>
      </div>

      <!-- Hottest Repository -->
      <div class="mb-6 p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-gradient-to-r from-orange-50 to-transparent dark:from-orange-900/10">
        <h2 class="flex items-center gap-2 text-lg font-semibold mb-3">
          <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          🔥 Hottest Repository
        </h2>
        ${renderRepoCard(hottest, true)}
      </div>

      <!-- Repository Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        ${rest.map((repo) => renderRepoCard(repo)).join('')}
      </div>

      <!-- Filters placeholder (hydrated on client) -->
      <div id="ssr-filters-section" class="hidden"></div>
    </div>
  `;
}

async function handler(request: Request, context: Context) {
  const url = new URL(request.url);

  // Only handle /trending path
  if (url.pathname !== '/trending') {
    return fallbackToSPA(context);
  }

  addBreadcrumb({
    message: 'SSR trending page request',
    category: 'ssr',
    level: 'info',
    data: { pathname: url.pathname },
  });

  // Check if we should SSR this request
  if (!shouldSSR(request)) {
    return fallbackToSPA(context);
  }

  try {
    // Fetch trending repositories and asset references in parallel
    const baseUrl = `${url.protocol}//${url.host}`;
    const [repos, assets] = await Promise.all([
      fetchTrendingRepos(20),
      getAssetReferences(baseUrl),
    ]);

    // Generate the page content
    const content = renderTrendingContent(repos);

    const meta: MetaTags = {
      title: 'Trending Repositories - contributor.info',
      description:
        'Discover trending repositories with significant recent activity and growth. Find the hottest GitHub projects based on stars, PRs, and contributor metrics.',
      image: 'https://contributor-info-social-cards.fly.dev/social-cards/trending',
    };

    const ssrData: SSRData = {
      route: '/trending',
      data: { repositories: repos },
      timestamp: Date.now(),
    };

    const html = renderHTML(content, meta, ssrData, request.url, assets);
    const headers = getSSRHeaders(120, 600); // 2 min cache, 10 min stale-while-revalidate

    return new Response(html, { headers });
  } catch (error) {
    console.error('[ssr-trending] Error:', error);
    addBreadcrumb({
      message: 'SSR trending page error, falling back to SPA',
      category: 'ssr',
      level: 'error',
      data: { error: String(error) },
    });

    // Fall back to SPA on error
    return fallbackToSPA(context);
  }
}

export default withSentry('ssr-trending', handler);

export const config = {
  path: '/trending',
};
