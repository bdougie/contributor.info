import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import React, { Suspense, lazy, useEffect } from 'react';
import { ThemeProvider } from '@/components/common/theming';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/error-boundary';
import { PWAInstallPrompt } from '@/components/ui/pwa-install-prompt';
import { OfflineNotification } from '@/components/common/OfflineNotification';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { FeatureFlagsProvider } from '@/lib/feature-flags';
import { useSubscriptionSync } from '@/hooks/use-subscription-sync';
// Lazy load core components to reduce initial bundle
const Layout = lazy(() =>
  import('@/components/common/layout').then((m) => ({ default: m.Layout }))
);
const Home = lazy(() => import('@/components/common/layout').then((m) => ({ default: m.Home })));
const NotFound = lazy(() =>
  import('@/components/common/layout').then((m) => ({ default: m.NotFound }))
);
import { ProtectedRoute, AdminRoute } from '@/components/features/auth';
import { initializeLLMCitationTracking } from '@/lib/llm-citation-tracking';
import { SVGSpriteInliner } from '@/components/ui/svg-sprite-loader';
import { WorkspaceRedirect } from '@/components/WorkspaceRedirect';

// Lazy load route components for better performance
const RepoView = lazy(() => import('@/components/features/repository/repo-view'));
const LotteryFactorRoute = lazy(() =>
  import('@/components/features/repository/repo-view').then((m) => ({
    default: m.LotteryFactorRoute,
  }))
);
const ContributionsRoute = lazy(() =>
  import('@/components/features/repository/repo-view').then((m) => ({
    default: m.ContributionsRoute,
  }))
);
const DistributionRoute = lazy(() =>
  import('@/components/features/repository/repo-view').then((m) => ({
    default: m.DistributionRoute,
  }))
);

// Auth components
const LoginPage = lazy(() => import('@/components/features/auth/login-page'));
const DebugAuthPage = lazy(() => import('@/components/features/auth/debug-auth-page'));
const TestInsights = lazy(() => import('@/components/features/auth/test-insights'));
const DebugMenu = lazy(() =>
  import('@/components/features/debug/debug-menu').then((m) => ({ default: m.DebugMenu }))
);
const ChangelogPage = lazy(() =>
  import('@/components/features/changelog/changelog-page').then((m) => ({
    default: m.ChangelogPage,
  }))
);
// Documentation components with routing
const DocsList = lazy(() =>
  import('@/components/features/docs/docs-list').then((m) => ({ default: m.DocsList }))
);
const DocDetail = lazy(() =>
  import('@/components/features/docs/doc-detail').then((m) => ({ default: m.DocDetail }))
);
const FeedPage = lazy(() => import('@/components/features/feed/feed-page'));
const SpamFeedPage = lazy(() => import('@/components/features/feed/spam-feed-page'));
const SocialCardPreview = lazy(() => import('@/components/social-cards/preview'));
const GitHubSyncDebug = lazy(() =>
  import('@/components/debug/github-sync-debug').then((m) => ({ default: m.GitHubSyncDebug }))
);
const ManualBackfillDebug = lazy(() =>
  import('@/components/features/debug/manual-backfill-debug').then((m) => ({
    default: m.ManualBackfillDebug,
  }))
);
const PerformanceMonitoringDashboard = lazy(() =>
  import('@/components/performance-monitoring-dashboard-lazy').then((m) => ({
    default: m.LazyPerformanceMonitoringDashboard,
  }))
);
const ShareableChartsPreview = lazy(() =>
  import('@/components/features/debug/shareable-charts-preview').then((m) => ({
    default: m.ShareableChartsPreview,
  }))
);
const DubTest = lazy(() =>
  import('@/components/features/debug/dub-test').then((m) => ({ default: m.DubTest }))
);
const BulkAddRepos = lazy(() =>
  import('@/components/features/debug/bulk-add-repos').then((m) => ({ default: m.BulkAddRepos }))
);

// Settings and Privacy components
const SettingsPage = lazy(() =>
  import('@/components/features/settings/settings-page').then((m) => ({ default: m.SettingsPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import('@/components/features/privacy/privacy-policy-page').then((m) => ({
    default: m.PrivacyPolicyPage,
  }))
);
const DataRequestPage = lazy(() =>
  import('@/components/features/privacy/data-request-page').then((m) => ({
    default: m.DataRequestPage,
  }))
);
const TermsPage = lazy(() =>
  import('@/components/features/privacy/terms-page').then((m) => ({ default: m.TermsPage }))
);

// Workspace components
const WorkspacePage = lazy(() => import('@/pages/workspace-page'));
const WorkspaceNewPage = lazy(() => import('@/pages/workspace-new-page'));
const DemoWorkspacePage = lazy(() => import('@/pages/demo-workspace-page'));
const WorkspaceRoutesWrapper = lazy(() =>
  import('@/components/features/workspace/WorkspaceRoutesWrapper').then((m) => ({
    default: m.WorkspaceRoutesWrapper,
  }))
);

// Trending components
const TrendingPageRoute = lazy(() =>
  import('@/pages/trending').then((m) => ({ default: m.TrendingPageRoute }))
);

// Admin components
const AdminMenu = lazy(() =>
  import('@/components/features/admin').then((m) => ({ default: m.AdminMenu }))
);
const UserManagement = lazy(() =>
  import('@/components/features/admin').then((m) => ({ default: m.UserManagement }))
);
const SpamManagement = lazy(() =>
  import('@/components/features/admin').then((m) => ({ default: m.SpamManagement }))
);
const SpamTestTool = lazy(() =>
  import('@/components/features/admin').then((m) => ({ default: m.SpamTestTool }))
);
const BulkSpamAnalysis = lazy(() =>
  import('@/components/features/admin').then((m) => ({ default: m.BulkSpamAnalysis }))
);
const MaintainerManagement = lazy(() =>
  import('@/components/features/admin/maintainer-management').then((m) => ({
    default: m.MaintainerManagement,
  }))
);
const ConfidenceAnalyticsDashboard = lazy(() =>
  import('@/components/features/admin/confidence-analytics-dashboard').then((m) => ({
    default: m.ConfidenceAnalyticsDashboard,
  }))
);
const AdminAnalyticsDashboard = lazy(() =>
  import('@/components/features/admin').then((m) => ({ default: m.AdminAnalyticsDashboard }))
);
const FailedJobsDashboard = lazy(() =>
  import('@/components/features/admin/failed-jobs-dashboard').then((m) => ({
    default: m.FailedJobsDashboard,
  }))
);
const LLMCitationDashboard = lazy(() =>
  import('@/components/features/analytics/llm-citation-dashboard').then((m) => ({
    default: m.LLMCitationDashboard,
  }))
);
const CaptureHealthMonitor = lazy(() =>
  import('@/components/CaptureHealthMonitor').then((m) => ({ default: m.CaptureHealthMonitor }))
);
const ProfileRouter = lazy(() =>
  import('@/components/features/profile/profile-router').then((m) => ({ default: m.ProfileRouter }))
);
const WidgetsPage = lazy(() => import('@/pages/widgets'));

// Billing components
const BillingDashboard = lazy(() =>
  import('@/pages/billing/BillingDashboard').then((m) => ({ default: m.BillingDashboard }))
);

// Invitation components
const InvitationAcceptancePage = lazy(() =>
  import('@/pages/invitation-acceptance-page').then((m) => ({
    default: m.InvitationAcceptancePage,
  }))
);

// Loading fallback component matching actual app structure
const PageSkeleton = () => {
  const isOrgPage = window.location.pathname.startsWith('/orgs/');
  const isRepoPage = /^\/[^/]+\/[^/]+/.test(window.location.pathname) && !isOrgPage;
  const isHomePage = window.location.pathname === '/';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header matching actual layout */}
      <header className="border-b">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center space-x-4">
            {/* Hamburger menu skeleton */}
            <div className="p-2">
              <div className="h-5 w-5 bg-muted animate-pulse rounded" />
            </div>
            {/* Logo/Title */}
            <div className="text-xl font-bold">contributor.info</div>
          </div>
          {/* Auth button skeleton */}
          <div className="ml-auto">
            <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 py-6 flex-1">
        {(() => {
          if (isHomePage) {
            /* Home page skeleton - centered card with search */
            return (
              <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
                <div className="w-full max-w-2xl border rounded-lg p-8 space-y-6">
                  {/* Title */}
                  <div className="space-y-3">
                    <div className="h-8 bg-muted animate-pulse rounded mx-auto w-3/4" />
                    <div className="h-5 bg-muted animate-pulse rounded mx-auto w-2/3" />
                  </div>
                  {/* Search input skeleton */}
                  <div className="h-10 bg-muted animate-pulse rounded" />
                  {/* Example repos skeleton */}
                  <div className="space-y-2 pt-4">
                    <div className="h-4 bg-muted animate-pulse rounded w-32" />
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-8 w-24 bg-muted animate-pulse rounded" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (isOrgPage) {
            /* Organization page skeleton */
            return (
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                  <span>/</span>
                  <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                </div>
                {/* Org header with avatar and name */}
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted animate-pulse rounded-md" />
                  <div>
                    <div className="h-8 w-32 bg-muted animate-pulse rounded mb-2" />
                    <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                  </div>
                </div>
                {/* Table skeleton */}
                <div className="border rounded-lg">
                  <div className="p-4 border-b">
                    <div className="h-6 w-24 bg-muted animate-pulse rounded" />
                  </div>
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-3 border-b last:border-0"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                          <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                        </div>
                        <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          /* Repository/default page skeleton */
          return (
            <div className="space-y-6">
              {/* Breadcrumbs for repo pages */}
              {isRepoPage && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                  <span>/</span>
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <span>/</span>
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                </div>
              )}
              {/* Page title */}
              <div className="h-8 w-2/3 bg-muted animate-pulse rounded" />
              {/* Content cards */}
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="border rounded-lg p-6 space-y-3">
                    <div className="h-5 w-3/4 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </main>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container px-4 text-center">
          <div className="h-4 w-32 bg-muted animate-pulse rounded mx-auto" />
        </div>
      </footer>
    </div>
  );
};

function App() {
  // Sync subscription status on app load
  useSubscriptionSync();

  // Initialize Web Vitals monitoring with PostHog
  // Deferred to requestIdleCallback to avoid blocking LCP
  useEffect(() => {
    const initVitals = () => {
      import('./lib/web-vitals-monitoring').then(({ initializeWebVitalsMonitoring }) => {
        const vitalsMonitor = initializeWebVitalsMonitoring({
          debug: process.env.NODE_ENV === 'development',
          // Optional: Set up reporting endpoint for production
          // reportingEndpoint: '/api/vitals'
        });

        // Enable Web Vitals analytics (Supabase first, PostHog after interaction)
        import('./lib/web-vitals-analytics').then(({ getWebVitalsAnalytics }) => {
          const analytics = getWebVitalsAnalytics();
          // Start with Supabase only (lightweight)
          analytics.setProviders(['supabase']);
        });

        // Log metrics to console in development
        if (process.env.NODE_ENV === 'development') {
          vitalsMonitor.onMetric((metric) => {
            // Additional logging or analytics can be added here
            if (metric.rating !== 'good') {
              console.warn(`Performance issue detected: ${metric.name}`, metric);
            }
          });
        }
      });
    };

    // Load after browser idle time to avoid blocking LCP
    if ('requestIdleCallback' in window) {
      requestIdleCallback(initVitals);
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(initVitals, 3000);
    }

    // Note: Cleanup handled by module singleton pattern
    return () => {};
  }, []);

  // Load PostHog on user interaction (Phase 3 optimization)
  useEffect(() => {
    let isPostHogLoaded = false;

    const loadPostHogOnInteraction = () => {
      if (isPostHogLoaded) return;
      isPostHogLoaded = true;

      // Load PostHog and enable it for web vitals
      import('./lib/posthog-lazy').then(({ initPostHog }) => {
        initPostHog().then(() => {
          // Add PostHog to analytics providers after it loads
          import('./lib/web-vitals-analytics').then(({ getWebVitalsAnalytics }) => {
            const analytics = getWebVitalsAnalytics();
            analytics.setProviders(['supabase', 'posthog']);
          });
        });
      });

      // Remove event listeners after first interaction
      events.forEach((e) => document.removeEventListener(e, loadPostHogOnInteraction));
    };

    // User interaction events that trigger PostHog loading
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) =>
      document.addEventListener(e, loadPostHogOnInteraction, { once: true, passive: true })
    );

    // Fallback: load after 3 seconds if no interaction
    const fallbackTimer = setTimeout(loadPostHogOnInteraction, 3000);

    return () => {
      events.forEach((e) => document.removeEventListener(e, loadPostHogOnInteraction));
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Initialize LLM Citation tracking
  useEffect(() => {
    const citationTracker = initializeLLMCitationTracking();

    if (process.env.NODE_ENV === 'development') {
      console.log('[LLM Citation Tracker] Initialized for tracking AI platform citations');
    }

    return () => {
      citationTracker.destroy();
    };
  }, []);

  // Preload critical routes and initialize progressive features after mount
  useEffect(() => {
    // Initialize auto-tracking service for 404 interception

    const initializeDeferred = async () => {
      // Priority 1: Preload most likely next routes immediately
      const criticalImports = [
        import('@/components/features/repository/repo-view'),
        import('@/components/features/auth/login-page'),
        import('@/lib/supabase'), // Critical for data loading
        import('@/hooks/use-cached-repo-data'),
      ];

      // Start critical loads immediately
      Promise.all(criticalImports).catch(console.warn);

      // Priority 2: Background progressive features (deferred to idle time)
      const loadProgressiveFeatures = () => {
        Promise.all([
          import('@/lib/progressive-capture/manual-trigger'),
          import('@/lib/progressive-capture/smart-notifications'),
          import('@/lib/progressive-capture/background-processor'),
        ]).catch(console.warn);
      };

      // Load after browser idle time to avoid blocking LCP
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadProgressiveFeatures, { timeout: 5000 });
      } else {
        // Fallback for browsers without requestIdleCallback (use original timing)
        setTimeout(loadProgressiveFeatures, 500);
      }
    };

    initializeDeferred();

    // Cleanup on unmount
    return () => {};
  }, []);

  return (
    <ErrorBoundary context="Application Root">
      <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
        <FeatureFlagsProvider>
          <SVGSpriteInliner />
          <Router>
            <WorkspaceProvider>
              <OfflineNotification />
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />

                  {/* Legacy Route Redirects - Resolves ~480 404 errors */}
                  {/* These routes are deprecated but still receive traffic from old links/bookmarks */}
                  <Route path="/signup" element={<Navigate to="/login" replace />} />

                  <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="/trending" element={<TrendingPageRoute />} />
                    {/* Workspace routes - protected by feature flag */}
                    {/* Dynamic configuration to support both /i/ and /workspaces/ paths */}
                    {['/i', '/workspaces'].map((basePath) => (
                      <React.Fragment key={basePath}>
                        <Route
                          path={`${basePath}/demo`}
                          element={
                            <WorkspaceRoutesWrapper>
                              <DemoWorkspacePage />
                            </WorkspaceRoutesWrapper>
                          }
                        />
                        <Route
                          path={`${basePath}/demo/:tab`}
                          element={
                            <WorkspaceRoutesWrapper>
                              <DemoWorkspacePage />
                            </WorkspaceRoutesWrapper>
                          }
                        />
                        <Route
                          path={`${basePath}/:workspaceId`}
                          element={
                            <WorkspaceRoutesWrapper>
                              <WorkspacePage />
                            </WorkspaceRoutesWrapper>
                          }
                        />
                        <Route
                          path={`${basePath}/:workspaceId/:tab`}
                          element={
                            <WorkspaceRoutesWrapper>
                              <WorkspacePage />
                            </WorkspaceRoutesWrapper>
                          }
                        />
                      </React.Fragment>
                    ))}
                    <Route
                      path="/workspaces/new"
                      element={
                        <WorkspaceRoutesWrapper>
                          <WorkspaceNewPage />
                        </WorkspaceRoutesWrapper>
                      }
                    />
                    {/* Redirect common typos: singular to plural */}
                    <Route
                      path="/workspace/new"
                      element={<Navigate to="/workspaces/new" replace />}
                    />
                    <Route path="/workspace/:id" element={<WorkspaceRedirect />} />
                    <Route path="/workspace/:id/:tab" element={<WorkspaceRedirect includeTab />} />
                    <Route path="/changelog" element={<ChangelogPage />} />
                    <Route path="/docs" element={<DocsList />} />
                    <Route path="/docs/:slug" element={<DocDetail />} />

                    {/* Invitation acceptance route */}
                    <Route path="/invitation/:token" element={<InvitationAcceptancePage />} />

                    {/* Legacy Route Redirect - Old feedback page moved to docs */}
                    <Route path="/search/feedback" element={<Navigate to="/docs" replace />} />
                    <Route path="/widgets" element={<WidgetsPage />} />
                    <Route path="/:owner/:repo/widgets" element={<WidgetsPage />} />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute>
                          <SettingsPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/billing"
                      element={
                        <ProtectedRoute>
                          <BillingDashboard />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/privacy" element={<PrivacyPolicyPage />} />
                    <Route path="/privacy/data-request" element={<DataRequestPage />} />
                    <Route path="/terms" element={<TermsPage />} />

                    {/* Debug routes with Layout */}
                    <Route
                      path="/dev"
                      element={
                        <ProtectedRoute>
                          <DebugMenu />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dev/test-insights"
                      element={
                        <ProtectedRoute>
                          <TestInsights />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dev/debug-auth"
                      element={
                        <ProtectedRoute>
                          <DebugAuthPage />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/dev/social-cards" element={<SocialCardPreview />} />
                    <Route
                      path="/dev/sync-test"
                      element={
                        <ProtectedRoute>
                          <GitHubSyncDebug />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dev/manual-backfill"
                      element={
                        <ProtectedRoute>
                          <ManualBackfillDebug />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="/dev/shareable-charts" element={<ShareableChartsPreview />} />
                    <Route
                      path="/dev/dub-test"
                      element={
                        <ProtectedRoute>
                          <DubTest />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/dev/capture-monitor"
                      element={
                        <ProtectedRoute>
                          <CaptureHealthMonitor />
                        </ProtectedRoute>
                      }
                    />

                    {/* Admin routes - require admin privileges */}
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <AdminMenu />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/users"
                      element={
                        <AdminRoute>
                          <UserManagement />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/analytics"
                      element={
                        <AdminRoute>
                          <AdminAnalyticsDashboard />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/performance-monitoring"
                      element={
                        <AdminRoute>
                          <PerformanceMonitoringDashboard />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/bulk-add-repos"
                      element={
                        <AdminRoute>
                          <BulkAddRepos />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/spam"
                      element={
                        <AdminRoute>
                          <SpamManagement />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/spam-test"
                      element={
                        <AdminRoute>
                          <SpamTestTool />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/bulk-spam-analysis"
                      element={
                        <AdminRoute>
                          <BulkSpamAnalysis />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/maintainers"
                      element={
                        <AdminRoute>
                          <MaintainerManagement />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/confidence-analytics"
                      element={
                        <AdminRoute>
                          <ConfidenceAnalyticsDashboard />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/llm-citations"
                      element={
                        <AdminRoute>
                          <LLMCitationDashboard />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/admin/failed-jobs"
                      element={
                        <AdminRoute>
                          <FailedJobsDashboard />
                        </AdminRoute>
                      }
                    />

                    <Route path="/:owner/:repo" element={<RepoView />}>
                      <Route path="" element={<ContributionsRoute />} />
                      <Route path="activity" element={<ContributionsRoute />} />
                      <Route path="contributions" element={<ContributionsRoute />} />
                      <Route path="health" element={<LotteryFactorRoute />} />
                      <Route path="distribution" element={<DistributionRoute />} />
                      <Route path="feed" element={<FeedPage />} />
                      <Route
                        path="feed/spam"
                        element={
                          <ProtectedRoute>
                            <SpamFeedPage />
                          </ProtectedRoute>
                        }
                      />
                    </Route>

                    {/* Profile view (user/org) - after repo routes to prevent intercepting repo patterns */}
                    <Route path="/:username" element={<ProfileRouter />} />

                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
              <Toaster />
              <PWAInstallPrompt
                onInstall={() => console.log('PWA installed successfully!')}
                onDismiss={() => console.log('PWA install prompt dismissed')}
              />
            </WorkspaceProvider>
          </Router>
        </FeatureFlagsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
