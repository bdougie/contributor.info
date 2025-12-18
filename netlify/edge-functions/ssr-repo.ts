/**
 * Edge SSR for Repository Page
 *
 * Renders repository pages with pre-rendered HTML for better LCP and SEO.
 * This is the most important SSR page as repo pages are frequently shared.
 */

import type { Context } from '@netlify/edge-functions';
import { withSentry, addBreadcrumb } from './_shared/sentry.ts';
import {
  renderHTML,
  getSSRHeaders,
  getAssetReferences,
  html,
  type SafeHTML,
  type MetaTags,
  type RepoPageData,
} from './_shared/html-template.ts';
import { fetchRepository, fetchRepoContributorStats, type RepoData } from './_shared/supabase.ts';
import { formatNumber, shouldSSR, fallbackToSPA, parseRepoPath } from './_shared/ssr-utils.ts';

const SOCIAL_CARDS_BASE = 'https://contributor-info-social-cards.fly.dev';

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
 * Render contributor avatars
 */
function renderContributorAvatars(
  contributors: Array<{ login: string; avatar_url: string; contributions: number }>
): SafeHTML {
  if (contributors.length === 0) {
    return html`<p class="text-sm text-muted-foreground">Loading contributors...</p>`;
  }

  return html`
    <div class="flex -space-x-2">
      ${contributors.slice(0, 8).map(
        (c) => html`
          <a href="https://github.com/${c.login}" target="_blank" rel="noopener" class="relative">
            <img
              src="${c.avatar_url}&s=64"
              alt="${c.login}"
              class="w-8 h-8 rounded-full border-2 border-background"
              loading="lazy"
            />
          </a>
        `
      )}
      ${contributors.length > 8
        ? html`
            <div
              class="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium"
            >
              +${contributors.length - 8}
            </div>
          `
        : ''}
    </div>
  `;
}

/**
 * Render skeleton loading state
 */
function renderRepoSkeleton(owner: string, repo: string): SafeHTML {
  return html`
    <div class="min-h-screen bg-background">
      <div class="container mx-auto px-4 py-6">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <a href="/" class="hover:text-foreground">Home</a>
          <span>/</span>
          <a href="/${owner}" class="hover:text-foreground">${owner}</a>
          <span>/</span>
          <span class="text-foreground font-medium">${repo}</span>
        </nav>

        <!-- Header Card Skeleton -->
        <div class="rounded-lg border bg-card shadow-sm mb-6">
          <div class="p-6">
            <div class="flex items-start justify-between gap-4 mb-4">
              <div class="min-w-0 w-full max-w-2xl">
                <div class="h-8 bg-muted animate-pulse rounded w-3/4 mb-2"></div>
                <div class="h-5 bg-muted animate-pulse rounded w-full mb-1"></div>
                <div class="h-5 bg-muted animate-pulse rounded w-2/3"></div>
              </div>
              <div class="h-9 w-20 bg-muted animate-pulse rounded"></div>
            </div>

            <div class="flex gap-2 mb-4">
              <div class="h-6 w-20 bg-muted animate-pulse rounded-full"></div>
              <div class="h-6 w-24 bg-muted animate-pulse rounded-full"></div>
            </div>

            <div class="flex flex-wrap items-center gap-4">
              <div class="h-5 w-24 bg-muted animate-pulse rounded"></div>
              <div class="h-5 w-24 bg-muted animate-pulse rounded"></div>
              <div class="h-5 w-32 bg-muted animate-pulse rounded"></div>
            </div>
          </div>

          <div class="border-t px-6 py-4">
            <div class="flex items-center justify-between mb-3">
              <div class="h-5 w-32 bg-muted animate-pulse rounded"></div>
              <div class="h-5 w-16 bg-muted animate-pulse rounded"></div>
            </div>
            <div class="flex -space-x-2">
              <div
                class="w-8 h-8 rounded-full border-2 border-background bg-muted animate-pulse"
              ></div>
              <div
                class="w-8 h-8 rounded-full border-2 border-background bg-muted animate-pulse"
              ></div>
              <div
                class="w-8 h-8 rounded-full border-2 border-background bg-muted animate-pulse"
              ></div>
              <div
                class="w-8 h-8 rounded-full border-2 border-background bg-muted animate-pulse"
              ></div>
            </div>
          </div>
        </div>

        <!-- Tab Navigation Skeleton -->
        <div class="mb-6">
          <div class="inline-flex h-10 items-center rounded-md bg-muted p-1">
            <div class="h-8 w-24 bg-background rounded-sm shadow-sm"></div>
            <div class="h-8 w-24"></div>
            <div class="h-8 w-24"></div>
            <div class="h-8 w-24"></div>
          </div>
        </div>

        <!-- Content Placeholder -->
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2 space-y-6">
            <div class="rounded-lg border bg-card p-6">
              <div class="animate-pulse space-y-4">
                <div class="h-6 bg-muted rounded w-1/3"></div>
                <div class="h-64 bg-muted rounded"></div>
              </div>
            </div>
          </div>
          <div class="space-y-6">
            <div class="rounded-lg border bg-card p-6">
              <div class="animate-pulse space-y-4">
                <div class="h-5 bg-muted rounded w-1/2"></div>
                <div class="h-32 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the repository page HTML content
 */
function renderRepoContent(
  repo: RepoData,
  contributorStats: {
    count: number;
    topContributors: Array<{ login: string; avatar_url: string; contributions: number }>;
  }
): SafeHTML {
  const languageColor = repo.language ? LANGUAGE_COLORS[repo.language] || '#858585' : null;
  const description = repo.description ? repo.description : 'No description available';

  const topics = (repo.topics || []).slice(0, 5);

  return html`
    <div class="min-h-screen bg-background">
      <div class="container mx-auto px-4 py-6">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <a href="/" class="hover:text-foreground">Home</a>
          <span>/</span>
          <a href="/${repo.owner}" class="hover:text-foreground">${repo.owner}</a>
          <span>/</span>
          <span class="text-foreground font-medium">${repo.name}</span>
        </nav>

        <!-- Header Card -->
        <div class="rounded-lg border bg-card shadow-sm mb-6">
          <div class="p-6">
            <!-- Repo Title -->
            <div class="flex items-start justify-between gap-4 mb-4">
              <div class="min-w-0">
                <h1 class="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
                  <a
                    href="https://github.com/${repo.full_name}"
                    target="_blank"
                    rel="noopener"
                    class="hover:underline"
                  >
                    <span class="text-muted-foreground">${repo.owner}/</span>${repo.name}
                  </a>
                </h1>
                <p class="text-muted-foreground">${description}</p>
              </div>
              <!-- Share Button Placeholder -->
              <button
                class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3"
                id="ssr-share-button"
              >
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Share
              </button>
            </div>

            <!-- Topics -->
            ${topics.length > 0
              ? html`
                  <div class="flex flex-wrap gap-2 mb-4">
                    ${topics.map(
                      (topic) =>
                        html`<span
                          class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                          >${topic}</span
                        >`
                    )}
                  </div>
                `
              : ''}

            <!-- Stats Row -->
            <div class="flex flex-wrap items-center gap-4 text-sm">
              ${languageColor
                ? html`
                    <span class="flex items-center gap-1.5">
                      <span
                        class="w-3 h-3 rounded-full"
                        style="background-color: ${languageColor}"
                      ></span>
                      ${repo.language!}
                    </span>
                  `
                : ''}
              <a
                href="https://github.com/${repo.full_name}/stargazers"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1 hover:text-primary"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path
                    d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"
                  />
                </svg>
                ${formatNumber(repo.stargazer_count)} stars
              </a>
              <a
                href="https://github.com/${repo.full_name}/forks"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1 hover:text-primary"
              >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path
                    d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z"
                  />
                </svg>
                ${formatNumber(repo.fork_count)} forks
              </a>
              <span class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path
                    d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z"
                  />
                </svg>
                ${formatNumber(contributorStats.count)} contributors
              </span>
            </div>
          </div>

          <!-- Top Contributors -->
          <div class="border-t px-6 py-4">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-medium">Top Contributors</h2>
              <a
                href="https://github.com/${repo.full_name}/graphs/contributors"
                target="_blank"
                rel="noopener"
                class="text-sm text-muted-foreground hover:text-primary"
              >
                View all →
              </a>
            </div>
            <div class="mt-3">${renderContributorAvatars(contributorStats.topContributors)}</div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="mb-6">
          <div
            class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"
          >
            <a
              href="/${repo.full_name}"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all bg-background text-foreground shadow-sm"
            >
              Contributions
            </a>
            <a
              href="/${repo.full_name}/health"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:text-foreground"
            >
              Health
            </a>
            <a
              href="/${repo.full_name}/distribution"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:text-foreground"
            >
              Distribution
            </a>
            <a
              href="/${repo.full_name}/feed"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:text-foreground"
            >
              Feed
            </a>
          </div>
        </div>

        <!-- Content Placeholder (will be hydrated) -->
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-2 space-y-6">
            <!-- Chart placeholder -->
            <div class="rounded-lg border bg-card p-6">
              <div class="animate-pulse space-y-4">
                <div class="h-6 bg-muted rounded w-1/3"></div>
                <div class="h-64 bg-muted rounded"></div>
              </div>
            </div>
          </div>
          <div class="space-y-6">
            <!-- Sidebar placeholder -->
            <div class="rounded-lg border bg-card p-6">
              <div class="animate-pulse space-y-4">
                <div class="h-5 bg-muted rounded w-1/2"></div>
                <div class="h-32 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function handler(request: Request, context: Context) {
  const url = new URL(request.url);

  console.log(`[ssr-repo] Handling request for ${url.pathname}`);

  // Parse owner/repo from path
  const parsed = parseRepoPath(url.pathname);
  if (!parsed) {
    console.log('[ssr-repo] Failed to parse repo path, falling back to SPA');
    return fallbackToSPA(context);
  }

  const { owner, repo } = parsed;

  addBreadcrumb({
    message: 'SSR repo page request',
    category: 'ssr',
    level: 'info',
    data: { owner, repo, pathname: url.pathname },
  });

  // Check if we should SSR this request
  if (!shouldSSR(request)) {
    return fallbackToSPA(context);
  }

  try {
    // Start fetching asset references immediately
    const baseUrl = `${url.protocol}//${url.host}`;
    const assetsPromise = getAssetReferences(baseUrl);

    // Fetch repository data and contributor stats in parallel with assets
    const [assets, repoData, contributorStats] = await Promise.all([
      assetsPromise,
      fetchRepository(owner, repo),
      fetchRepoContributorStats(owner, repo),
    ]);

    // Fall back to SPA if assets couldn't be loaded (critical for hydration)
    if (assets.fallbackToSPA) {
      console.warn('[ssr-repo] Asset loading failed, falling back to SPA');
      return fallbackToSPA(context);
    }

    // If repo not found or error, render the skeleton as a fallback
    // This ensures the user sees the Repo structure while the client-side tries to fetch/handle 404
    if (!repoData) {
      console.warn(`[ssr-repo] Repository ${owner}/${repo} not found or error, rendering skeleton`);
      addBreadcrumb({
        message: 'Repository not found or error, rendering skeleton',
        category: 'ssr',
        level: 'warning',
        data: { owner, repo },
      });

      // Render skeleton with empty data for hydration
      const content = renderRepoSkeleton(owner, repo);
      const meta: MetaTags = {
        title: `${owner}/${repo} - contributor.info`,
        description: `Analyze contributors for ${owner}/${repo}`,
        image: `${SOCIAL_CARDS_BASE}/social-cards/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      };

      // Pass null data to force client-side fetch
      const ssrData: { route: string; data: null; timestamp: number } = {
        route: `/${owner}/${repo}`,
        data: null,
        timestamp: Date.now(),
      };

      const html = renderHTML(content, meta, ssrData, request.url, assets);
      // Short cache for error states
      const headers = getSSRHeaders(10, 60);
      return new Response(html, { headers });
    }

    // Success path - generate the full page content
    const content = renderRepoContent(repoData, contributorStats);

    const meta: MetaTags = {
      title: `${owner}/${repo} Contributors - contributor.info`,
      description:
        repoData.description ||
        `Explore contributors and contribution patterns for ${owner}/${repo} on GitHub.`,
      image: `${SOCIAL_CARDS_BASE}/social-cards/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
    };

    const ssrData: { route: string; data: RepoPageData; timestamp: number } = {
      route: `/${owner}/${repo}`,
      data: {
        owner,
        repo,
        repository: {
          id: repoData.id,
          owner: repoData.owner,
          name: repoData.name,
          full_name: repoData.full_name,
          description: repoData.description,
          stargazer_count: repoData.stargazer_count,
          fork_count: repoData.fork_count,
          language: repoData.language,
          topics: repoData.topics,
          updated_at: repoData.updated_at,
        },
        contributorStats,
      },
      timestamp: Date.now(),
    };

    const html = renderHTML(content, meta, ssrData, request.url, assets);
    const headers = getSSRHeaders(300, 3600); // 5 min cache, 1 hour stale-while-revalidate

    return new Response(html, { headers });
  } catch (error) {
    console.error('[ssr-repo] Error: %o', error);
    addBreadcrumb({
      message: 'SSR repo page error, rendering skeleton',
      category: 'ssr',
      level: 'error',
      data: { owner, repo, error: String(error) },
    });

    // On critical error, still try to render skeleton if we have assets
    try {
      const baseUrl = `${url.protocol}//${url.host}`;
      const assets = await getAssetReferences(baseUrl);

      const content = renderRepoSkeleton(owner, repo);
      const meta: MetaTags = {
        title: `${owner}/${repo} - contributor.info`,
        description: `Analyze contributors for ${owner}/${repo}`,
      };

      const ssrData: { route: string; data: null; timestamp: number } = {
        route: `/${owner}/${repo}`,
        data: null,
        timestamp: Date.now(),
      };

      const html = renderHTML(content, meta, ssrData, request.url, assets);
      return new Response(html, { headers: getSSRHeaders(0, 0) });
    } catch (e) {
      console.error('[ssr-repo] Critical error during fallback: %o', e);
      // Ultimate fallback to SPA
      return fallbackToSPA(context);
    }
  }
}

export default withSentry('ssr-repo', handler);

export const config = {
  path: '/:owner/:repo',
  excludedPath: [
    '/api/*',
    '/assets/*',
    '/js/*',
    '/css/*',
    '/icons/*',
    '/login',
    '/settings',
    '/admin/*',
    '/dev/*',
    '/i/*',
    '/workspaces/*',
    '/trending',
    '/widgets',
    '/changelog',
    '/privacy',
    '/terms',
    '/billing',
    '/invitation/*',
    '/*.js',
    '/*.css',
    '/*.json',
    '/*.png',
    '/*.svg',
    '/*.ico',
  ],
};
