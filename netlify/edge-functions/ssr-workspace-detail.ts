/**
 * Edge SSR for Individual Workspace Pages (/i/:slug)
 *
 * Renders workspace detail pages with pre-rendered HTML for better LCP and SEO.
 * Workspaces will be public in the future, making this important for sharing.
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
  type WorkspaceDetailPageData,
} from './_shared/html-template.ts';
import { fetchWorkspaceBySlug, type WorkspaceDetailData } from './_shared/supabase.ts';
import { shouldSSR, fallbackToSPA, formatNumber } from './_shared/ssr-utils.ts';

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
};

// Valid slug pattern: alphanumeric, hyphens, underscores only
const VALID_SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Extract workspace slug from URL path
 */
function parseWorkspaceSlug(pathname: string): string | null {
  // Match /i/:slug pattern
  const match = pathname.match(/^\/i\/([^/]+)/);
  if (!match) return null;

  const slug = match[1];

  // Length validation
  if (!slug || slug.length < 1 || slug.length > 100) {
    return null;
  }

  // Character validation: only allow safe characters
  if (!VALID_SLUG_PATTERN.test(slug)) {
    console.warn('[ssr-workspace-detail] Invalid slug characters: %s', slug);
    return null;
  }

  return slug;
}

/**
 * Render workspace detail content
 */
function renderWorkspaceContent(workspace: WorkspaceDetailData): SafeHTML {
  const ownerName = workspace.owner?.github_username || 'Unknown';
  const ownerAvatar =
    workspace.owner?.avatar_url || `https://avatars.githubusercontent.com/u/0?v=4`;

  return html`
    <div class="min-h-screen bg-background">
      <div class="container mx-auto px-4 py-6">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <a href="/" class="hover:text-foreground">Home</a>
          <span>/</span>
          <a href="/workspaces" class="hover:text-foreground">Workspaces</a>
          <span>/</span>
          <span class="text-foreground font-medium">${workspace.name}</span>
        </nav>

        <!-- Header Card -->
        <div class="rounded-lg border bg-card shadow-sm mb-6">
          <div class="p-6">
            <div class="flex items-start gap-4">
              <!-- Owner Avatar -->
              <img
                src="${ownerAvatar}"
                alt="${ownerName}"
                class="w-12 h-12 rounded-full border"
                loading="lazy"
              />

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 mb-2">
                  <h1 class="text-2xl font-bold tracking-tight">${workspace.name}</h1>
                  <span
                    class="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    ${workspace.tier}
                  </span>
                </div>

                <p class="text-muted-foreground mb-4">
                  ${workspace.description || 'No description provided'}
                </p>

                <!-- Stats Row -->
                <div class="flex flex-wrap items-center gap-6 text-sm">
                  <span class="flex items-center gap-2">
                    <svg
                      class="w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <strong>${formatNumber(workspace.repository_count)}</strong> repositories
                  </span>
                  <span class="flex items-center gap-2">
                    <svg
                      class="w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <strong>${formatNumber(workspace.contributor_count)}</strong> contributors
                  </span>
                  <span class="flex items-center gap-2">
                    <svg
                      class="w-4 h-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <strong>${formatNumber(workspace.member_count)}</strong> members
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Navigation -->
        <div class="mb-6">
          <div
            class="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"
          >
            <a
              href="/i/${workspace.slug}"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all bg-background text-foreground shadow-sm"
            >
              Overview
            </a>
            <a
              href="/i/${workspace.slug}/contributors"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:text-foreground"
            >
              Contributors
            </a>
            <a
              href="/i/${workspace.slug}/prs"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:text-foreground"
            >
              Pull Requests
            </a>
            <a
              href="/i/${workspace.slug}/activity"
              class="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all hover:text-foreground"
            >
              Activity
            </a>
          </div>
        </div>

        <!-- Repositories Grid -->
        ${workspace.repositories.length > 0
          ? html`
              <div class="mb-8">
                <h2 class="text-lg font-semibold mb-4">Repositories</h2>
                <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  ${workspace.repositories.map(
                    (repo) => html`
                      <a
                        href="/${repo.full_name}"
                        class="block rounded-lg border bg-card p-4 hover:shadow-md transition-shadow"
                      >
                        <div class="flex items-start justify-between mb-2">
                          <h3 class="font-medium truncate">${repo.name}</h3>
                          ${repo.language
                            ? html`
                                <span class="flex items-center gap-1 text-xs text-muted-foreground">
                                  <span
                                    class="w-2 h-2 rounded-full"
                                    style="background-color: ${LANGUAGE_COLORS[repo.language] ||
                                    '#858585'}"
                                  ></span>
                                  ${repo.language}
                                </span>
                              `
                            : ''}
                        </div>
                        <p class="text-sm text-muted-foreground line-clamp-2 mb-3">
                          ${repo.description || 'No description'}
                        </p>
                        <div class="flex items-center gap-3 text-xs text-muted-foreground">
                          <span class="flex items-center gap-1">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                              <path
                                d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"
                              />
                            </svg>
                            ${formatNumber(repo.stargazer_count)}
                          </span>
                          <span class="text-muted-foreground/50">${repo.owner}</span>
                        </div>
                      </a>
                    `
                  )}
                </div>
                ${workspace.repository_count > 6
                  ? html`
                      <p class="text-sm text-muted-foreground text-center mt-4">
                        and ${workspace.repository_count - 6} more repositories...
                      </p>
                    `
                  : ''}
              </div>
            `
          : html`
              <div class="rounded-lg border bg-card p-8 text-center">
                <p class="text-muted-foreground">No repositories in this workspace yet.</p>
              </div>
            `}

        <!-- Content Placeholder (will be hydrated with charts, etc.) -->
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
 * Render skeleton loading state
 */
function renderWorkspaceSkeleton(slug: string): SafeHTML {
  return html`
    <div class="min-h-screen bg-background">
      <div class="container mx-auto px-4 py-6">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <a href="/" class="hover:text-foreground">Home</a>
          <span>/</span>
          <a href="/workspaces" class="hover:text-foreground">Workspaces</a>
          <span>/</span>
          <span class="text-foreground font-medium">${slug}</span>
        </nav>

        <!-- Header Skeleton -->
        <div class="rounded-lg border bg-card shadow-sm mb-6">
          <div class="p-6">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-full bg-muted animate-pulse"></div>
              <div class="flex-1 space-y-3">
                <div class="h-7 w-48 bg-muted animate-pulse rounded"></div>
                <div class="h-5 w-96 bg-muted animate-pulse rounded"></div>
                <div class="flex gap-6">
                  <div class="h-4 w-24 bg-muted animate-pulse rounded"></div>
                  <div class="h-4 w-28 bg-muted animate-pulse rounded"></div>
                  <div class="h-4 w-20 bg-muted animate-pulse rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Skeleton -->
        <div class="mb-6">
          <div class="inline-flex h-10 items-center rounded-md bg-muted p-1">
            <div class="h-8 w-24 bg-background rounded-sm shadow-sm"></div>
            <div class="h-8 w-28"></div>
            <div class="h-8 w-28"></div>
            <div class="h-8 w-20"></div>
          </div>
        </div>

        <!-- Content Skeleton -->
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
          ${[1, 2, 3].map(
            () => html`
              <div class="rounded-lg border bg-card p-4">
                <div class="space-y-3">
                  <div class="h-5 w-3/4 bg-muted animate-pulse rounded"></div>
                  <div class="h-4 w-full bg-muted animate-pulse rounded"></div>
                  <div class="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
                </div>
              </div>
            `
          )}
        </div>
      </div>
    </div>
  `;
}

/**
 * Render not found page
 */
function renderNotFound(slug: string): SafeHTML {
  return html`
    <div class="min-h-screen bg-background flex items-center justify-center">
      <div class="text-center px-4">
        <h1 class="text-6xl font-bold text-primary mb-4">404</h1>
        <h2 class="text-2xl font-semibold mb-2">Workspace Not Found</h2>
        <p class="text-muted-foreground mb-6">
          The workspace "${slug}" doesn't exist or has been removed.
        </p>
        <div class="flex gap-4 justify-center">
          <a
            href="/workspaces"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4"
          >
            Browse Workspaces
          </a>
          <a
            href="/"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  `;
}

async function handler(request: Request, context: Context) {
  const url = new URL(request.url);

  console.log('[ssr-workspace-detail] Handling request for %s', url.pathname);

  // Parse workspace slug from path
  const slug = parseWorkspaceSlug(url.pathname);
  if (!slug) {
    console.log('[ssr-workspace-detail] Failed to parse workspace slug, falling back to SPA');
    return fallbackToSPA(context);
  }

  addBreadcrumb({
    message: 'SSR workspace detail page request',
    category: 'ssr',
    level: 'info',
    data: { slug, pathname: url.pathname },
  });

  // Check if we should SSR this request
  if (!shouldSSR(request)) {
    return fallbackToSPA(context);
  }

  try {
    // Start fetching asset references immediately
    const baseUrl = `${url.protocol}//${url.host}`;
    const [assets, workspace] = await Promise.all([
      getAssetReferences(baseUrl),
      fetchWorkspaceBySlug(slug),
    ]);

    // Fall back to SPA if assets couldn't be loaded
    if (assets.fallbackToSPA) {
      console.warn('[ssr-workspace-detail] Asset loading failed, falling back to SPA');
      return fallbackToSPA(context);
    }

    // Handle workspace not found
    if (!workspace) {
      console.warn('[ssr-workspace-detail] Workspace not found: %s', slug);

      const content = renderNotFound(slug);
      const meta: MetaTags = {
        title: 'Workspace Not Found - contributor.info',
        description: 'The requested workspace could not be found.',
      };

      const ssrData: {
        route: 'workspace-detail';
        data: WorkspaceDetailPageData;
        timestamp: number;
      } = {
        route: 'workspace-detail',
        data: { workspace: null },
        timestamp: Date.now(),
      };

      const htmlContent = renderHTML(content, meta, ssrData, request.url, assets);
      return new Response(htmlContent, {
        status: 404,
        headers: getSSRHeaders(60, 300),
      });
    }

    // Render workspace content
    const content = renderWorkspaceContent(workspace);
    const meta: MetaTags = {
      title: `${workspace.name} - contributor.info`,
      description:
        workspace.description ||
        `Explore contributors and analytics for the ${workspace.name} workspace.`,
      image: `${SOCIAL_CARDS_BASE}/social-cards/workspace?name=${encodeURIComponent(workspace.name)}&repos=${workspace.repository_count}&contributors=${workspace.contributor_count}`,
    };

    const ssrData: { route: 'workspace-detail'; data: WorkspaceDetailPageData; timestamp: number } =
      {
        route: 'workspace-detail',
        data: { workspace },
        timestamp: Date.now(),
      };

    const htmlContent = renderHTML(content, meta, ssrData, request.url, assets);
    // Cache for 5 minutes, stale-while-revalidate for 1 hour
    return new Response(htmlContent, { headers: getSSRHeaders(300, 3600) });
  } catch (error) {
    console.error('[ssr-workspace-detail] Error: %o', error);
    addBreadcrumb({
      message: 'SSR workspace detail page error',
      category: 'ssr',
      level: 'error',
      data: { slug, error: String(error) },
    });

    // On error, try to render skeleton
    try {
      const baseUrl = `${url.protocol}//${url.host}`;
      const assets = await getAssetReferences(baseUrl);

      if (assets.fallbackToSPA) {
        return fallbackToSPA(context);
      }

      const content = renderWorkspaceSkeleton(slug);
      const meta: MetaTags = {
        title: `${slug} - contributor.info`,
        description: `View the ${slug} workspace on contributor.info`,
      };

      const ssrData: {
        route: 'workspace-detail';
        data: WorkspaceDetailPageData;
        timestamp: number;
      } = {
        route: 'workspace-detail',
        data: { workspace: null },
        timestamp: Date.now(),
      };

      const htmlContent = renderHTML(content, meta, ssrData, request.url, assets);
      return new Response(htmlContent, { headers: getSSRHeaders(0, 0) });
    } catch (e) {
      console.error('[ssr-workspace-detail] Critical error during fallback: %o', e);
      return fallbackToSPA(context);
    }
  }
}

export default withSentry('ssr-workspace-detail', handler);

export const config = {
  path: '/i/*',
};
