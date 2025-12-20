/**
 * Edge SSR for Profile Page (User/Organization)
 *
 * Renders user/org pages with pre-rendered HTML for better LCP and SEO.
 * Falls back to client-side rendering if data is not in Supabase.
 */

import type { Context } from '@netlify/edge-functions';
import { withSentry, addBreadcrumb } from './_shared/sentry.ts';
import {
  renderHTML,
  getSSRHeaders,
  getAssetReferences,
  renderHeader,
  renderFooter,
  html,
  type SafeHTML,
  type MetaTags,
  type RepoData,
} from './_shared/html-template.ts';
import { fetchRepositoriesByOwner } from './_shared/supabase.ts';
import { formatNumber, shouldSSR, fallbackToSPA } from './_shared/ssr-utils.ts';

const SOCIAL_CARDS_BASE = 'https://contributor-info-social-cards.fly.dev';

/**
 * Language colors for display (matching client-side)
 */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  'C#': '#239120',
  Go: '#00ADD8',
  Rust: '#dea584',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#fa7343',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  HTML: '#e34c26',
  CSS: '#1572B6',
};

/**
 * Render profile skeleton loading state
 */
function renderProfileSkeleton(username: string): SafeHTML {
  return html`
    <div class="min-h-screen bg-background flex flex-col">
      ${renderHeader()}
      <main class="flex-1 bg-muted/50 dark:bg-black">
        <div class="max-w-6xl mx-auto p-6 space-y-6">
          <!-- Breadcrumbs -->
          <nav class="flex items-center gap-2 text-sm text-muted-foreground">
            <a href="/" class="hover:text-foreground transition-colors">Home</a>
            <span>/</span>
            <span class="text-foreground font-medium">${username}</span>
          </nav>

          <!-- Header -->
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-muted animate-pulse"></div>
            <div>
              <h1 class="text-3xl font-bold tracking-tight">${username}</h1>
              <div class="h-4 w-48 bg-muted animate-pulse rounded mt-2"></div>
            </div>
          </div>

          <!-- Table Skeleton -->
          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="p-4 border-b">
              <div class="h-6 w-24 bg-muted animate-pulse rounded"></div>
            </div>
            <div class="p-4 space-y-3">
              <div class="flex items-center justify-between py-3 border-b last:border-0">
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-32 bg-muted animate-pulse rounded"></div>
                  <div class="h-3 w-48 bg-muted animate-pulse rounded"></div>
                </div>
                <div class="h-6 w-16 bg-muted animate-pulse rounded"></div>
              </div>
              <div class="flex items-center justify-between py-3 border-b last:border-0">
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-32 bg-muted animate-pulse rounded"></div>
                  <div class="h-3 w-48 bg-muted animate-pulse rounded"></div>
                </div>
                <div class="h-6 w-16 bg-muted animate-pulse rounded"></div>
              </div>
              <div class="flex items-center justify-between py-3 border-b last:border-0">
                <div class="flex-1 space-y-2">
                  <div class="h-4 w-32 bg-muted animate-pulse rounded"></div>
                  <div class="h-3 w-48 bg-muted animate-pulse rounded"></div>
                </div>
                <div class="h-6 w-16 bg-muted animate-pulse rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </main>
      ${renderFooter()}
    </div>
  `;
}

/**
 * Render activity level badge
 */
function renderActivityBadge(updatedAt: string): SafeHTML {
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  let label = 'Low';
  let classes = 'bg-gray-100 text-gray-800';

  if (daysSinceUpdate <= 7) {
    label = 'Active';
    classes = 'bg-green-100 text-green-800';
  } else if (daysSinceUpdate <= 30) {
    label = 'Moderate';
    classes = 'bg-yellow-100 text-yellow-800';
  }

  return html`<div
    class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent ${classes}"
  >
    ${label}
  </div>`;
}

/**
 * Render the profile page HTML content
 */
function renderProfileContent(username: string, repos: RepoData[]): SafeHTML {
  const avatarUrl = `https://github.com/${username}.png`;

  return html`
    <div class="min-h-screen bg-background flex flex-col">
      ${renderHeader()}
      <main class="flex-1 bg-muted/50 dark:bg-black">
        <div class="max-w-6xl mx-auto p-6 space-y-6">
          <!-- Breadcrumbs -->
          <nav class="flex items-center gap-2 text-sm text-muted-foreground">
            <a href="/" class="hover:text-foreground transition-colors">Home</a>
            <span>/</span>
            <span class="text-foreground font-medium">${username}</span>
          </nav>

          <!-- Header -->
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <img
                src="${avatarUrl}"
                alt="${username}"
                class="w-12 h-12 rounded-full border-2 border-background"
                loading="lazy"
              />
              <div>
                <h1 class="text-3xl font-bold tracking-tight">${username}</h1>
                <p class="text-muted-foreground">Collaborative projects from this GitHub profile</p>
              </div>
            </div>
          </div>

          <!-- Repositories Table -->
          <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div class="flex flex-col space-y-1.5 p-6">
              <h3 class="font-semibold leading-none tracking-tight flex items-center gap-2">
                <svg
                  class="w-5 h-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Collaborative Repositories
                <div
                  class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 ml-auto"
                >
                  ${repos.length} tracked
                </div>
              </h3>
            </div>
            <div class="p-6 pt-0">
              <div class="relative w-full overflow-auto">
                <table class="w-full caption-bottom text-sm">
                  <thead class="[&_tr]:border-b">
                    <tr
                      class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    >
                      <th
                        class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                      >
                        Repository
                      </th>
                      <th
                        class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                      >
                        Description
                      </th>
                      <th
                        class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                      >
                        Activity
                      </th>
                      <th
                        class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                      >
                        Language
                      </th>
                      <th
                        class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody class="[&_tr:last-child]:border-0">
                    ${repos
                      .map(
                        (repo) => html`
                          <tr
                            class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                          >
                            <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0 font-medium">
                              <div class="flex flex-col">
                                <a
                                  href="/${repo.owner}/${repo.name}"
                                  class="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  ${repo.name}
                                </a>
                                <div
                                  class="flex items-center gap-2 mt-1 text-xs text-muted-foreground"
                                >
                                  <span class="flex items-center gap-1">
                                    <svg
                                      class="w-3 h-3"
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    >
                                      <polygon
                                        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                                      />
                                    </svg>
                                    ${formatNumber(repo.stargazer_count)}
                                  </span>
                                  <span class="flex items-center gap-1">
                                    <svg
                                      class="w-3 h-3"
                                      xmlns="http://www.w3.org/2000/svg"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      stroke-width="2"
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                    >
                                      <circle cx="12" cy="18" r="3" />
                                      <circle cx="6" cy="6" r="3" />
                                      <circle cx="18" cy="6" r="3" />
                                      <path d="M6 9v1a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V9" />
                                      <path d="M12 12v3" />
                                    </svg>
                                    ${formatNumber(repo.fork_count)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0 max-w-md">
                              <p class="text-sm text-muted-foreground truncate">
                                ${repo.description || 'No description available'}
                              </p>
                            </td>
                            <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                              ${renderActivityBadge(repo.updated_at)}
                            </td>
                            <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                              ${repo.language
                                ? html`
                                    <div class="flex items-center gap-2">
                                      <div
                                        class="w-3 h-3 rounded-full"
                                        style="background-color: ${LANGUAGE_COLORS[repo.language] ||
                                        '#6b7280'}"
                                      ></div>
                                      <span class="text-sm">${repo.language}</span>
                                    </div>
                                  `
                                : ''}
                            </td>
                            <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
                              <button
                                class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-6 px-2"
                              >
                                <svg
                                  class="w-3 h-3 mr-1"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"
                                >
                                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                  <circle cx="12" cy="12" r="3" />
                                </svg>
                                View
                              </button>
                            </td>
                          </tr>
                        `
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
      ${renderFooter()}
    </div>
  `;
}

async function handler(request: Request, context: Context) {
  const url = new URL(request.url);

  // Extract username from path (first segment)
  const username = url.pathname.split('/').filter(Boolean)[0];

  console.log('[ssr-profile] Handling request for %s (username: %s)', url.pathname, username);

  if (!username) {
    return fallbackToSPA(context);
  }

  addBreadcrumb({
    message: 'SSR profile page request',
    category: 'ssr',
    level: 'info',
    data: { username, pathname: url.pathname },
  });

  // Check if we should SSR this request
  if (!shouldSSR(request)) {
    return fallbackToSPA(context);
  }

  try {
    // Start fetching asset references immediately
    const baseUrl = `${url.protocol}//${url.host}`;
    const assetsPromise = getAssetReferences(baseUrl);

    // Fetch repositories from Supabase (only tracked ones)
    const [assets, repos] = await Promise.all([
      assetsPromise,
      fetchRepositoriesByOwner(username, 25),
    ]);

    // Fall back to SPA if assets couldn't be loaded
    if (assets.fallbackToSPA) {
      console.warn('[ssr-profile] Asset loading failed, falling back to SPA');
      return fallbackToSPA(context);
    }

    // If no repos found in Supabase, we can't do much (don't know if user exists)
    // Render skeleton and let client-side try to fetch from GitHub
    if (!repos || repos.length === 0) {
      console.log(
        '[ssr-profile] No tracked repos found for %s, rendering skeleton for client fetch',
        username
      );

      const content = renderProfileSkeleton(username);
      const meta: MetaTags = {
        title: `${username} - contributor.info`,
        description: `View ${username}'s contribution history and open source project insights.`,
        image: `${SOCIAL_CARDS_BASE}/social-cards/user?username=${encodeURIComponent(username)}`,
      };

      // Pass null data to force client-side fetch
      const ssrData = {
        route: `/${username}`,
        data: null,
        timestamp: Date.now(),
      };

      const html = renderHTML(content, meta, ssrData, request.url, assets);
      return new Response(html, { headers: getSSRHeaders(10, 60) });
    }

    // Success path - render profile with tracked repos
    const content = renderProfileContent(username, repos);

    const meta: MetaTags = {
      title: `${username} - Open Source Contributor`,
      description: `View ${username}'s contribution history and open source project insights. Discover their collaborative repositories.`,
      image: `${SOCIAL_CARDS_BASE}/social-cards/user?username=${encodeURIComponent(username)}`,
    };

    // We can pass the initial data to client if we want, but client fetches from GitHub
    // So we might want to pass null to force client fetch (which is more complete with GitHub data)
    // OR we pass what we have and client enhances it.
    // For now, let's pass null to force client consistency with GitHub data
    const ssrData = {
      route: `/${username}`,
      data: null, // Let client fetch full data including untracked repos
      timestamp: Date.now(),
    };

    const html = renderHTML(content, meta, ssrData, request.url, assets);
    const headers = getSSRHeaders(300, 3600);

    return new Response(html, { headers });
  } catch (error) {
    console.error('[ssr-profile] Error: %o', error);
    addBreadcrumb({
      message: 'SSR profile page error, rendering skeleton',
      category: 'ssr',
      level: 'error',
      data: { username, error: String(error) },
    });

    try {
      const baseUrl = `${url.protocol}//${url.host}`;
      const assets = await getAssetReferences(baseUrl);

      const content = renderProfileSkeleton(username);
      const meta: MetaTags = {
        title: `${username} - contributor.info`,
      };

      const html = renderHTML(
        content,
        meta,
        { route: `/${username}`, data: null },
        request.url,
        assets
      );
      return new Response(html, { headers: getSSRHeaders(0, 0) });
    } catch {
      return fallbackToSPA(context);
    }
  }
}

export default withSentry('ssr-profile', handler);
