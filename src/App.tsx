import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router';
import React, { Suspense, lazy, useEffect } from 'react';
import { ThemeProvider } from '@/components/common/theming';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorBoundary } from '@/components/error-boundary';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { FeatureFlagsProvider } from '@/lib/feature-flags';
import { TourProviderWithNavigation } from '@/components/features/onboarding';
import { useSubscriptionSync } from '@/hooks/use-subscription-sync';
import { logger } from '@/lib/logger';
import { isHydrationComplete, isSSRPage } from '@/lib/ssr-hydration';
// Eagerly load core layout components to prevent hydration flash
import { Layout, Home } from '@/components/common/layout';
// Eagerly load repo skeleton to prevent layout mismatch during lazy loading
import { RepoViewSkeleton } from '@/components/skeletons/layouts/repo-view-skeleton';
// SVGSpriteInliner must be eagerly loaded (not lazy) as it's needed immediately
// to inline SVG sprites for the entire app (rendered early in the component tree)
import { SVGSpriteInliner } from '@/components/ui/svg-sprite-loader';

// Lazy load UI components that aren't needed for initial LCP
const Toaster = lazy(() => import('@/components/ui/sonner').then((m) => ({ default: m.Toaster })));
const PWAInstallPrompt = lazy(() =>
  import('@/components/ui/pwa-install-prompt').then((m) => ({ default: m.PWAInstallPrompt }))
);
const OfflineNotification = lazy(() =>
  import('@/components/common/OfflineNotification').then((m) => ({
    default: m.OfflineNotification,
  }))
);

const NotFound = lazy(() =>
  import('@/components/common/layout').then((m) => ({ default: m.NotFound }))
);
// Lazy load auth guards - only needed when navigating to protected routes
const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
// Lazy load workspace redirect - only needed when navigating to legacy /workspace/* routes
const WorkspaceRedirect = lazy(() =>
  import('@/components/WorkspaceRedirect').then((m) => ({ default: m.WorkspaceRedirect }))
);

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
// Documentation has been migrated to Mintlify
// See mintlify-docs/ directory
const FeedPage = lazy(() => import('@/components/features/feed/feed-page'));
// SpamFeedPage moved to workspace scope - see WorkspaceSpamTab
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

// Spam report page (public)
const SpamReportPage = lazy(() =>
  import('@/components/features/spam').then((m) => ({ default: m.SpamReportPage }))
);

// Workspace components
const WorkspacePage = lazy(() => import('@/pages/workspace-page'));
const WorkspaceNewPage = lazy(() => import('@/pages/workspace-new-page'));
const WorkspacesPage = lazy(() => import('@/pages/workspaces-page'));
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

/**
 * Check if the current URL matches a repo route pattern (/:owner/:repo)
 */
function isRepoRoute(): boolean {
  const path = window.location.pathname;
  // Match /:owner/:repo pattern but exclude known routes
  const excludedPaths = [
    '/login',
    '/settings',
    '/admin',
    '/dev',
    '/i/',
    '/workspaces',
    '/trending',
    '/widgets',
    '/changelog',
    '/privacy',
    '/terms',
    '/billing',
    '/invitation',
    '/signup',
    '/spam',
  ];
  if (excludedPaths.some((p) => path.startsWith(p))) {
    return false;
  }
  // Check for owner/repo pattern (two path segments)
  const segments = path.split('/').filter(Boolean);
  return segments.length >= 2;
}

/**
 * Hydration-aware loading fallback
 *
 * During SSR hydration: Returns null to preserve SSR content (prevents flash)
 * During SPA navigation: Shows skeleton for visual feedback
 *
 * This prevents the skeleton from flashing when React hydrates SSR content,
 * as the SSR HTML is already visible and doesn't need a loading placeholder.
 */
const PageSkeleton = () => {
  // Check synchronously on first render to avoid flash
  // Show skeleton if: not an SSR page (SPA navigation) OR hydration is complete (subsequent Suspense)
  const isSSR = isSSRPage();
  const hydrationDone = isHydrationComplete();

  // During SSR hydration (SSR page and hydration not yet complete), return null
  // This preserves the SSR-rendered content instead of replacing it with skeleton
  if (isSSR && !hydrationDone) {
    return null;
  }

  // For repo routes, show the repo-specific skeleton that matches the actual layout
  // MUST match Layout component's structure exactly for zero CLS
  if (isRepoRoute()) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b">
          <div className="flex h-16 items-center px-4 max-w-7xl mx-auto">
            <div className="text-xl font-bold">contributor.info</div>
            <div className="ml-auto h-9 w-20 bg-muted animate-pulse rounded-md" />
          </div>
        </header>
        {/* Match Layout's main structure exactly */}
        <main className="flex-1 bg-muted/50 dark:bg-black focus:outline-none">
          <div className="container px-4 py-6">
            <RepoViewSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      role="status"
      aria-label="Loading content"
    >
      {/* Minimal header */}
      <header className="border-b">
        <div className="flex h-16 items-center px-4 max-w-7xl mx-auto">
          <div className="text-xl font-bold">contributor.info</div>
          <div className="ml-auto h-9 w-20 bg-muted animate-pulse rounded-md" />
        </div>
      </header>
      {/* Minimal content skeleton */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-2xl px-4 space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded w-3/4 mx-auto" />
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-4 bg-muted animate-pulse rounded w-1/2 mx-auto" />
        </div>
      </main>
      <span className="sr-only">Loading content, please wait...</span>
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
          debug: (import.meta.env?.NODE_ENV || process.env.NODE_ENV) === 'development',
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
        if ((import.meta.env?.NODE_ENV || process.env.NODE_ENV) === 'development') {
          vitalsMonitor.onMetric((metric) => {
            // Additional logging or analytics can be added here
            if (metric.rating !== 'good') {
              logger.warn(`Performance issue detected: ${metric.name}`, metric);
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
    let sessionRecordingTimer: ReturnType<typeof setTimeout> | null = null;

    const loadPostHogOnInteraction = () => {
      if (isPostHogLoaded) return;
      isPostHogLoaded = true;

      // Load PostHog and enable it for web vitals
      import('./lib/posthog-lazy').then(({ initPostHog, enableSessionRecording }) => {
        initPostHog().then(() => {
          // Add PostHog to analytics providers after it loads
          import('./lib/web-vitals-analytics').then(({ getWebVitalsAnalytics }) => {
            const analytics = getWebVitalsAnalytics();
            analytics.setProviders(['supabase', 'posthog']);
          });

          // Enable session recording after 30 seconds (deferred for LCP improvement)
          // This delays loading the heavy rrweb library (~80KB) until well after LCP
          // See: https://github.com/bdougie/contributor.info/issues/1400
          sessionRecordingTimer = setTimeout(() => {
            enableSessionRecording();
          }, 30000);
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

    // Fallback: load after 5 seconds if no interaction (extended from 3s for LCP improvement)
    const fallbackTimer = setTimeout(loadPostHogOnInteraction, 5000);

    return () => {
      events.forEach((e) => document.removeEventListener(e, loadPostHogOnInteraction));
      clearTimeout(fallbackTimer);
      if (sessionRecordingTimer) {
        clearTimeout(sessionRecordingTimer);
      }
    };
  }, []);

  // Initialize LLM Citation tracking (deferred to avoid blocking FCP)
  useEffect(() => {
    let citationTracker: { destroy: () => void } | null = null;

    import('@/lib/llm-citation-tracking').then(({ initializeLLMCitationTracking }) => {
      citationTracker = initializeLLMCitationTracking();
      if ((import.meta.env?.NODE_ENV || process.env.NODE_ENV) === 'development') {
        logger.debug('[LLM Citation Tracker] Initialized for tracking AI platform citations');
      }
    });

    return () => {
      citationTracker?.destroy();
    };
  }, []);

  // Initialize global error tracking with PostHog
  useEffect(() => {
    import('./lib/error-tracker').then(({ setupGlobalErrorTracking }) => {
      setupGlobalErrorTracking();
      if ((import.meta.env?.NODE_ENV || process.env.NODE_ENV) === 'development') {
        logger.debug('[Error Tracking] Global error handlers initialized with PostHog');
      }
    });
  }, []);

  // Load progressive features AFTER LCP with guaranteed 5-second delay
  useEffect(() => {
    // Progressive features are non-critical - wait 5 seconds to ensure FCP/LCP complete first
    const loadProgressiveFeatures = () => {
      Promise.all([
        import('@/lib/progressive-capture/manual-trigger'),
        import('@/lib/progressive-capture/smart-notifications'),
        import('@/lib/progressive-capture/background-processor'),
      ]).catch((error) => logger.warn('Failed to load progressive features', error));
    };

    // Wait 5 seconds, then schedule during idle time if available
    const timeoutId = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadProgressiveFeatures);
      } else {
        loadProgressiveFeatures();
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <ErrorBoundary context="Application Root">
      <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
        <FeatureFlagsProvider>
          <TooltipProvider>
            <SVGSpriteInliner />
            <Router>
              <WorkspaceProvider>
                <TourProviderWithNavigation>
                  <Suspense fallback={null}>
                    <OfflineNotification />
                  </Suspense>
                  <Suspense fallback={<PageSkeleton />}>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />

                      {/* Legacy Route Redirects - Resolves ~480 404 errors */}
                      {/* These routes are deprecated but still receive traffic from old links/bookmarks */}
                      <Route path="/signup" element={<Navigate to="/login" replace />} />

                      <Route path="/" element={<Layout />}>
                        <Route index element={<Home />} />
                        <Route path="/trending" element={<TrendingPageRoute />} />
                        {/* Invitation acceptance route - must come before workspace routes to avoid conflicts */}
                        <Route path="/invitation/:token" element={<InvitationAcceptancePage />} />
                        {/* Workspace routes - protected by feature flag */}
                        {/* Workspaces list page */}
                        <Route path="/workspaces" element={<WorkspacesPage />} />
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
                        <Route
                          path="/workspace/:id/:tab"
                          element={<WorkspaceRedirect includeTab />}
                        />
                        <Route path="/changelog" element={<ChangelogPage />} />
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
                        <Route path="/billing" element={<BillingDashboard />} />
                        <Route path="/privacy" element={<PrivacyPolicyPage />} />
                        <Route path="/privacy/data-request" element={<DataRequestPage />} />
                        <Route path="/terms" element={<TermsPage />} />
                        <Route path="/spam" element={<SpamReportPage />} />

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
                          {/* Spam feed moved to workspace scope - /i/{workspaceId}/spam */}
                        </Route>

                        {/* Profile view (user/org) - after repo routes to prevent intercepting repo patterns */}
                        <Route path="/:username" element={<ProfileRouter />} />

                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Routes>
                  </Suspense>
                  <Suspense fallback={null}>
                    <Toaster />
                  </Suspense>
                  <Suspense fallback={null}>
                    <PWAInstallPrompt
                      onInstall={() => logger.debug('PWA installed successfully!')}
                      onDismiss={() => logger.debug('PWA install prompt dismissed')}
                    />
                  </Suspense>
                </TourProviderWithNavigation>
              </WorkspaceProvider>
            </Router>
          </TooltipProvider>
        </FeatureFlagsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
