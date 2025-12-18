/**
 * Edge SSR for Workspace Creation Page
 *
 * Renders the workspace creation page with pre-rendered HTML.
 * This page requires authentication, so unauthenticated users
 * are shown a login prompt.
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
} from './_shared/html-template.ts';
import { shouldSSR, fallbackToSPA } from './_shared/ssr-utils.ts';

/**
 * Check if user has auth token in cookies
 */
function hasAuthToken(request: Request): boolean {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return false;

  // Check for Supabase auth cookie presence
  return cookieHeader.includes('sb-') && cookieHeader.includes('-auth-token=');
}

/**
 * Render the authenticated workspace creation page
 */
function renderCreateWorkspaceContent(): SafeHTML {
  return html`
    <div class="min-h-screen bg-background">
      <div class="container max-w-2xl mx-auto py-8 px-4">
        <!-- Header -->
        <div class="mb-8">
          <a
            href="/"
            class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Home
          </a>

          <div class="space-y-2">
            <h1 class="text-3xl font-bold tracking-tight">Create New Workspace</h1>
            <p class="text-muted-foreground">
              Organize your favorite repositories and collaborate with your team. You can add
              repositories and invite members after creating your workspace.
            </p>
          </div>
        </div>

        <!-- Form Card Skeleton (will hydrate with real form) -->
        <div class="rounded-lg border bg-card shadow-sm">
          <div class="p-6 border-b">
            <h2 class="text-lg font-semibold">Workspace Details</h2>
          </div>
          <div class="p-6 space-y-6">
            <!-- Name Field -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Workspace Name</label>
              <div class="h-10 bg-muted animate-pulse rounded-md"></div>
            </div>

            <!-- Description Field -->
            <div class="space-y-2">
              <label class="text-sm font-medium">Description</label>
              <div class="h-24 bg-muted animate-pulse rounded-md"></div>
            </div>

            <!-- Buttons -->
            <div class="flex justify-end gap-3 pt-4">
              <div class="h-10 w-20 bg-muted animate-pulse rounded-md"></div>
              <div class="h-10 w-32 bg-muted animate-pulse rounded-md"></div>
            </div>
          </div>
        </div>

        <!-- Help Text -->
        <div class="mt-6 text-center">
          <p class="text-sm text-muted-foreground">
            Need help? Check out our
            <a href="/docs" class="text-primary hover:underline">documentation</a>
            to learn more about workspaces.
          </p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render the unauthenticated login prompt
 */
function renderLoginPrompt(): SafeHTML {
  return html`
    <div class="min-h-screen bg-background flex items-center justify-center">
      <div class="container max-w-md mx-auto px-4">
        <div class="rounded-lg border bg-card shadow-sm p-8 text-center">
          <div
            class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6"
          >
            <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>

          <h1 class="text-2xl font-bold mb-2">Create a Workspace</h1>
          <p class="text-muted-foreground mb-6">
            Sign in with GitHub to create your workspace and start tracking repositories.
          </p>

          <a
            href="/login?redirect=/workspaces/new"
            class="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-11 px-8 w-full"
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

          <p class="text-xs text-muted-foreground mt-4">
            Already have workspaces?
            <a href="/workspaces" class="text-primary hover:underline">View your workspaces</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

async function handler(request: Request, context: Context) {
  const url = new URL(request.url);

  console.log('[ssr-workspace-new] Handling request for %s', url.pathname);

  addBreadcrumb({
    message: 'SSR workspace new page request',
    category: 'ssr',
    level: 'info',
    data: { pathname: url.pathname },
  });

  // Check if we should SSR this request
  if (!shouldSSR(request)) {
    return fallbackToSPA(context);
  }

  try {
    const baseUrl = `${url.protocol}//${url.host}`;
    const assets = await getAssetReferences(baseUrl);

    if (assets.fallbackToSPA) {
      console.warn('[ssr-workspace-new] Asset loading failed, falling back to SPA');
      return fallbackToSPA(context);
    }

    const isAuthenticated = hasAuthToken(request);

    const meta: MetaTags = {
      title: 'Create New Workspace - contributor.info',
      description:
        'Create a workspace to organize and track your open source repositories and contributors.',
    };

    const content = isAuthenticated ? renderCreateWorkspaceContent() : renderLoginPrompt();

    const ssrData = {
      route: 'workspaces/new',
      data: { authenticated: isAuthenticated },
      timestamp: Date.now(),
    };

    const htmlContent = renderHTML(content, meta, ssrData, request.url, assets);
    // Short cache since this is a form page
    return new Response(htmlContent, { headers: getSSRHeaders(60, 300) });
  } catch (error) {
    console.error('[ssr-workspace-new] Error: %o', error);
    addBreadcrumb({
      message: 'SSR workspace new page error',
      category: 'ssr',
      level: 'error',
      data: { error: String(error) },
    });

    return fallbackToSPA(context);
  }
}

export default withSentry('ssr-workspace-new', handler);

export const config = {
  path: '/workspaces/new',
};
