/**
 * Edge SSR for Workspaces Page
 *
 * Renders the workspaces page with pre-rendered HTML for better LCP.
 * Handles two states:
 * - Authenticated: Shows user's workspaces with preview data
 * - Unauthenticated: Shows marketing content with demo workspace stats
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
  type WorkspacesPageData,
} from './_shared/html-template.ts';
import {
  fetchUserWorkspaces,
  fetchDemoWorkspaceStats,
  type WorkspacePreview,
} from './_shared/supabase.ts';
import { shouldSSR, fallbackToSPA, formatNumber } from './_shared/ssr-utils.ts';

/**
 * Extract auth token from request cookies
 */
function getAuthToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  // Parse Supabase auth token from cookies
  // Supabase stores tokens in sb-<project-ref>-auth-token cookie
  const cookies = cookieHeader.split(';').map((c) => c.trim());

  for (const cookie of cookies) {
    // Look for the access token in the Supabase auth cookie
    if (cookie.startsWith('sb-') && cookie.includes('-auth-token=')) {
      try {
        const value = cookie.split('=')[1];
        if (value) {
          // The token might be URL encoded JSON
          const decoded = decodeURIComponent(value);
          const parsed = JSON.parse(decoded);
          if (parsed.access_token) {
            return parsed.access_token;
          }
        }
      } catch {
        // Continue to next cookie
      }
    }
  }

  return null;
}

/**
 * Render the authenticated workspaces page content
 */
function renderAuthenticatedContent(workspaces: WorkspacePreview[]): SafeHTML {
  return html`
    <div class="min-h-screen bg-background">
      <div class="container mx-auto px-4 py-8">
        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold tracking-tight">Your Workspaces</h1>
            <p class="text-muted-foreground mt-1">
              Manage and analyze your repositories across workspaces
            </p>
          </div>
          <a
            href="/workspaces/new"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Workspace
          </a>
        </div>

        <!-- Workspaces Grid -->
        ${workspaces.length > 0
          ? html`
              <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                ${workspaces.map(
                  (ws) => html`
                    <a
                      href="/i/${ws.slug}"
                      class="block rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div class="p-6">
                        <div class="flex items-start justify-between mb-4">
                          <div class="min-w-0">
                            <h3 class="font-semibold text-lg truncate">${ws.name}</h3>
                            <p class="text-sm text-muted-foreground truncate">
                              ${ws.description || 'No description'}
                            </p>
                          </div>
                          <span
                            class="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                          >
                            ${ws.tier}
                          </span>
                        </div>

                        <div class="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                          <span class="flex items-center gap-1">
                            <svg
                              class="w-4 h-4"
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
                            ${ws.repository_count} repos
                          </span>
                          <span class="flex items-center gap-1">
                            <svg
                              class="w-4 h-4"
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
                            ${ws.member_count} members
                          </span>
                        </div>

                        ${ws.repositories.length > 0
                          ? html`
                              <div class="space-y-2">
                                <p class="text-xs font-medium text-muted-foreground">
                                  Top Repositories
                                </p>
                                <div class="flex flex-wrap gap-1">
                                  ${ws.repositories
                                    .slice(0, 3)
                                    .map(
                                      (repo) => html`
                                        <span
                                          class="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs"
                                        >
                                          ${repo.name}
                                        </span>
                                      `
                                    )}
                                  ${ws.repository_count > 3
                                    ? html`
                                        <span
                                          class="inline-flex items-center text-xs text-muted-foreground"
                                        >
                                          +${ws.repository_count - 3} more
                                        </span>
                                      `
                                    : ''}
                                </div>
                              </div>
                            `
                          : ''}
                      </div>
                    </a>
                  `
                )}
              </div>
            `
          : html`
              <!-- Empty State -->
              <div class="rounded-lg border bg-card p-12 text-center">
                <div
                  class="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4"
                >
                  <svg
                    class="w-6 h-6 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold mb-2">No workspaces yet</h3>
                <p class="text-muted-foreground mb-6">
                  Create your first workspace to start tracking repositories and contributors.
                </p>
                <a
                  href="/workspaces/new"
                  class="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                >
                  Create Workspace
                </a>
              </div>
            `}
      </div>
    </div>
  `;
}

/**
 * Render the unauthenticated marketing page content
 */
function renderUnauthenticatedContent(stats: {
  totalWorkspaces: number;
  totalRepositories: number;
}): SafeHTML {
  return html`
    <div class="min-h-screen bg-background">
      <!-- Hero Section -->
      <div class="container mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          Organize Your Open Source Insights
        </h1>
        <p class="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Create workspaces to track repositories, analyze contributors, and gain insights across
          your entire open source portfolio.
        </p>

        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <a
            href="/login?redirect=/workspaces"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
          >
            Get Started Free
          </a>
          <a
            href="/demo"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-11 px-8"
          >
            View Demo
          </a>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-2 gap-8 max-w-md mx-auto">
          <div class="text-center">
            <p class="text-3xl font-bold">${formatNumber(stats.totalWorkspaces)}</p>
            <p class="text-sm text-muted-foreground">Active Workspaces</p>
          </div>
          <div class="text-center">
            <p class="text-3xl font-bold">${formatNumber(stats.totalRepositories)}</p>
            <p class="text-sm text-muted-foreground">Tracked Repositories</p>
          </div>
        </div>
      </div>

      <!-- Features Section -->
      <div class="bg-muted/50 py-16">
        <div class="container mx-auto px-4">
          <h2 class="text-2xl font-bold text-center mb-12">
            Everything you need to manage contributors
          </h2>

          <div class="grid md:grid-cols-3 gap-8">
            <div class="rounded-lg border bg-card p-6">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  class="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 class="font-semibold mb-2">Contribution Analytics</h3>
              <p class="text-sm text-muted-foreground">
                Track contribution patterns, identify top contributors, and understand your
                community's health.
              </p>
            </div>

            <div class="rounded-lg border bg-card p-6">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  class="w-5 h-5 text-primary"
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
              </div>
              <h3 class="font-semibold mb-2">Team Collaboration</h3>
              <p class="text-sm text-muted-foreground">
                Invite team members to your workspace and collaborate on repository analysis
                together.
              </p>
            </div>

            <div class="rounded-lg border bg-card p-6">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  class="w-5 h-5 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 class="font-semibold mb-2">Health Monitoring</h3>
              <p class="text-sm text-muted-foreground">
                Monitor repository health metrics and get alerts when contributor activity changes.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- CTA Section -->
      <div class="container mx-auto px-4 py-16 text-center">
        <h2 class="text-2xl font-bold mb-4">Ready to get started?</h2>
        <p class="text-muted-foreground mb-8">
          Sign in with GitHub to create your first workspace.
        </p>
        <a
          href="/login?redirect=/workspaces"
          class="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8"
        >
          <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path
              fill-rule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clip-rule="evenodd"
            />
          </svg>
          Sign in with GitHub
        </a>
      </div>
    </div>
  `;
}

/**
 * Render skeleton loading state
 */
function renderWorkspacesSkeleton(): SafeHTML {
  return html`
    <div class="min-h-screen bg-background">
      <div class="container mx-auto px-4 py-8">
        <!-- Header Skeleton -->
        <div class="flex items-center justify-between mb-8">
          <div class="space-y-2">
            <div class="h-8 w-48 bg-muted animate-pulse rounded"></div>
            <div class="h-5 w-72 bg-muted animate-pulse rounded"></div>
          </div>
          <div class="h-10 w-36 bg-muted animate-pulse rounded"></div>
        </div>

        <!-- Grid Skeleton -->
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          ${[1, 2, 3].map(
            () => html`
              <div class="rounded-lg border bg-card p-6">
                <div class="space-y-4">
                  <div class="flex items-start justify-between">
                    <div class="space-y-2 flex-1">
                      <div class="h-5 w-3/4 bg-muted animate-pulse rounded"></div>
                      <div class="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
                    </div>
                    <div class="h-6 w-16 bg-muted animate-pulse rounded-full"></div>
                  </div>
                  <div class="flex gap-4">
                    <div class="h-4 w-20 bg-muted animate-pulse rounded"></div>
                    <div class="h-4 w-24 bg-muted animate-pulse rounded"></div>
                  </div>
                  <div class="space-y-2">
                    <div class="h-3 w-24 bg-muted animate-pulse rounded"></div>
                    <div class="flex gap-1">
                      <div class="h-6 w-16 bg-muted animate-pulse rounded"></div>
                      <div class="h-6 w-20 bg-muted animate-pulse rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            `
          )}
        </div>
      </div>
    </div>
  `;
}

async function handler(request: Request, context: Context) {
  const url = new URL(request.url);

  console.log('[ssr-workspaces] Handling request for %s', url.pathname);

  addBreadcrumb({
    message: 'SSR workspaces page request',
    category: 'ssr',
    level: 'info',
    data: { pathname: url.pathname },
  });

  // Check if we should SSR this request
  if (!shouldSSR(request)) {
    return fallbackToSPA(context);
  }

  try {
    // Start fetching asset references immediately
    const baseUrl = `${url.protocol}//${url.host}`;
    const assetsPromise = getAssetReferences(baseUrl);

    // Extract auth token from cookies
    const authToken = getAuthToken(request);
    const isAuthenticated = !!authToken;

    // Fetch data based on auth state
    let workspaces: WorkspacePreview[] | null = null;
    let stats: { totalWorkspaces: number; totalRepositories: number } | null = null;

    if (isAuthenticated) {
      // Fetch user's workspaces in parallel with assets
      const [assets, userWorkspaces] = await Promise.all([
        assetsPromise,
        fetchUserWorkspaces(authToken),
      ]);

      // Fall back to SPA if assets couldn't be loaded
      if (assets.fallbackToSPA) {
        console.warn('[ssr-workspaces] Asset loading failed, falling back to SPA');
        return fallbackToSPA(context);
      }

      workspaces = userWorkspaces;

      // If auth failed or user has no app_user, show marketing page
      if (!workspaces) {
        console.log('[ssr-workspaces] Auth token invalid, rendering unauthenticated view');
        stats = await fetchDemoWorkspaceStats();

        const content = renderUnauthenticatedContent(stats);
        const meta: MetaTags = {
          title: 'Workspaces - contributor.info',
          description:
            'Create workspaces to organize and analyze your open source repositories and contributors.',
        };

        const ssrData: { route: 'workspaces'; data: WorkspacesPageData; timestamp: number } = {
          route: 'workspaces',
          data: { authenticated: false, stats },
          timestamp: Date.now(),
        };

        const htmlContent = renderHTML(content, meta, ssrData, request.url, assets);
        return new Response(htmlContent, { headers: getSSRHeaders(60, 300) });
      }

      // Render authenticated view
      const content = renderAuthenticatedContent(workspaces);
      const meta: MetaTags = {
        title: 'Your Workspaces - contributor.info',
        description: 'Manage and analyze your repositories across workspaces.',
      };

      const ssrData: { route: 'workspaces'; data: WorkspacesPageData; timestamp: number } = {
        route: 'workspaces',
        data: {
          authenticated: true,
          workspaces: workspaces.map((ws) => ({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            description: ws.description,
            repository_count: ws.repository_count,
            member_count: ws.member_count,
            repositories: ws.repositories,
          })),
        },
        timestamp: Date.now(),
      };

      const htmlContent = renderHTML(content, meta, ssrData, request.url, assets);
      // Shorter cache for authenticated pages
      return new Response(htmlContent, { headers: getSSRHeaders(30, 120) });
    } else {
      // Unauthenticated - fetch demo stats
      const [assets, demoStats] = await Promise.all([assetsPromise, fetchDemoWorkspaceStats()]);

      // Fall back to SPA if assets couldn't be loaded
      if (assets.fallbackToSPA) {
        console.warn('[ssr-workspaces] Asset loading failed, falling back to SPA');
        return fallbackToSPA(context);
      }

      stats = demoStats;

      const content = renderUnauthenticatedContent(stats);
      const meta: MetaTags = {
        title: 'Workspaces - contributor.info',
        description:
          'Create workspaces to organize and analyze your open source repositories and contributors.',
      };

      const ssrData: { route: 'workspaces'; data: WorkspacesPageData; timestamp: number } = {
        route: 'workspaces',
        data: { authenticated: false, stats },
        timestamp: Date.now(),
      };

      const htmlContent = renderHTML(content, meta, ssrData, request.url, assets);
      // Longer cache for public marketing page
      return new Response(htmlContent, { headers: getSSRHeaders(300, 3600) });
    }
  } catch (error) {
    console.error('[ssr-workspaces] Error: %o', error);
    addBreadcrumb({
      message: 'SSR workspaces page error',
      category: 'ssr',
      level: 'error',
      data: { error: String(error) },
    });

    // On error, try to render skeleton
    try {
      const baseUrl = `${url.protocol}//${url.host}`;
      const assets = await getAssetReferences(baseUrl);

      if (assets.fallbackToSPA) {
        return fallbackToSPA(context);
      }

      const content = renderWorkspacesSkeleton();
      const meta: MetaTags = {
        title: 'Workspaces - contributor.info',
        description:
          'Create workspaces to organize and analyze your open source repositories and contributors.',
      };

      const ssrData: { route: 'workspaces'; data: WorkspacesPageData; timestamp: number } = {
        route: 'workspaces',
        data: { authenticated: false },
        timestamp: Date.now(),
      };

      const htmlContent = renderHTML(content, meta, ssrData, request.url, assets);
      return new Response(htmlContent, { headers: getSSRHeaders(0, 0) });
    } catch (e) {
      console.error('[ssr-workspaces] Critical error during fallback: %o', e);
      return fallbackToSPA(context);
    }
  }
}

export default withSentry('ssr-workspaces', handler);

export const config = {
  path: '/workspaces',
};
