import { type RouteConfig, route, index, layout, prefix } from '@react-router/dev/routes';

/**
 * React Router v7 Routes Configuration
 *
 * Phase 1: Foundation setup with existing lazy-loaded components
 * Phase 2+: Gradually migrate routes to file-based routing with loaders
 *
 * Routes are organized by:
 * - Public routes (home, trending, repo pages)
 * - Auth routes (login)
 * - Protected routes (settings, workspaces)
 * - Admin routes
 */
export default [
  // Auth routes (outside main layout)
  route('login', 'routes/login.tsx'),

  // Legacy redirect
  route('signup', 'routes/signup-redirect.tsx'),

  // Main layout with all nested routes
  layout('routes/layout.tsx', [
    // Homepage
    index('routes/home.tsx'),

    // Public pages
    route('trending', 'routes/trending.tsx'),
    route('changelog', 'routes/changelog.tsx'),
    route('widgets', 'routes/widgets.tsx'),
    route('privacy', 'routes/privacy.tsx'),
    route('privacy/data-request', 'routes/data-request.tsx'),
    route('terms', 'routes/terms.tsx'),

    // Billing
    route('billing', 'routes/billing.tsx'),

    // Settings (protected)
    route('settings', 'routes/settings.tsx'),

    // Invitation
    route('invitation/:token', 'routes/invitation.tsx'),

    // Workspaces - /i/ prefix
    ...prefix('i', [
      route('demo', 'routes/workspace-demo.tsx', { id: 'i-demo' }),
      route('demo/:tab', 'routes/workspace-demo.tsx', { id: 'i-demo-tab' }),
      route(':workspaceId', 'routes/workspace.tsx', { id: 'i-workspace' }),
      route(':workspaceId/:tab', 'routes/workspace.tsx', { id: 'i-workspace-tab' }),
    ]),

    // Workspaces - /workspaces/ prefix
    ...prefix('workspaces', [
      route('new', 'routes/workspace-new.tsx'),
      route('demo', 'routes/workspace-demo.tsx', { id: 'workspaces-demo' }),
      route('demo/:tab', 'routes/workspace-demo.tsx', { id: 'workspaces-demo-tab' }),
      route(':workspaceId', 'routes/workspace.tsx', { id: 'workspaces-workspace' }),
      route(':workspaceId/:tab', 'routes/workspace.tsx', { id: 'workspaces-workspace-tab' }),
    ]),

    // Legacy workspace redirects
    route('workspace/new', 'routes/workspace-redirect.tsx', { id: 'workspace-new-redirect' }),
    route('workspace/:id', 'routes/workspace-redirect.tsx', { id: 'workspace-id-redirect' }),
    route('workspace/:id/:tab', 'routes/workspace-redirect.tsx', { id: 'workspace-tab-redirect' }),

    // Dev routes (protected)
    ...prefix('dev', [
      index('routes/dev/index.tsx'),
      route('test-insights', 'routes/dev/test-insights.tsx'),
      route('debug-auth', 'routes/dev/debug-auth.tsx'),
      route('social-cards', 'routes/dev/social-cards.tsx'),
      route('sync-test', 'routes/dev/sync-test.tsx'),
      route('manual-backfill', 'routes/dev/manual-backfill.tsx'),
      route('shareable-charts', 'routes/dev/shareable-charts.tsx'),
      route('dub-test', 'routes/dev/dub-test.tsx'),
      route('capture-monitor', 'routes/dev/capture-monitor.tsx'),
    ]),

    // Admin routes (admin only)
    ...prefix('admin', [
      index('routes/admin/index.tsx'),
      route('users', 'routes/admin/users.tsx'),
      route('analytics', 'routes/admin/analytics.tsx'),
      route('performance-monitoring', 'routes/admin/performance-monitoring.tsx'),
      route('bulk-add-repos', 'routes/admin/bulk-add-repos.tsx'),
      route('spam', 'routes/admin/spam.tsx'),
      route('spam-test', 'routes/admin/spam-test.tsx'),
      route('bulk-spam-analysis', 'routes/admin/bulk-spam-analysis.tsx'),
      route('maintainers', 'routes/admin/maintainers.tsx'),
      route('confidence-analytics', 'routes/admin/confidence-analytics.tsx'),
      route('llm-citations', 'routes/admin/llm-citations.tsx'),
      route('failed-jobs', 'routes/admin/failed-jobs.tsx'),
    ]),

    // Repository routes with nested children
    route(':owner/:repo', 'routes/repo.tsx', [
      index('routes/repo/contributions.tsx'),
      route('activity', 'routes/repo/contributions.tsx', { id: 'repo-activity' }),
      route('contributions', 'routes/repo/contributions.tsx', { id: 'repo-contributions-tab' }),
      route('health', 'routes/repo/health.tsx'),
      route('distribution', 'routes/repo/distribution.tsx'),
      route('feed', 'routes/repo/feed.tsx'),
      route('widgets', 'routes/repo/widgets.tsx'),
    ]),

    // Profile route - must come after repo to avoid conflicts
    route(':username', 'routes/profile.tsx'),

    // Catch-all 404
    route('*', 'routes/not-found.tsx'),
  ]),
] satisfies RouteConfig;
