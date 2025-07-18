import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { ThemeProvider } from "@/components/common/theming";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { PWAInstallPrompt } from "@/components/ui/pwa-install-prompt";
// Progressive capture modules loaded dynamically after initial render
import { Layout, Home, NotFound } from "@/components/common/layout";
import { ProtectedRoute, AdminRoute } from "@/components/features/auth";

// Lazy load route components for better performance
const RepoView = lazy(() => import("@/components/features/repository/repo-view"));
const LotteryFactorRoute = lazy(() => import("@/components/features/repository/repo-view").then(m => ({ default: m.LotteryFactorRoute })));
const ContributionsRoute = lazy(() => import("@/components/features/repository/repo-view").then(m => ({ default: m.ContributionsRoute })));
const DistributionRoute = lazy(() => import("@/components/features/repository/repo-view").then(m => ({ default: m.DistributionRoute })));

const LoginPage = lazy(() => import("@/components/features/auth/login-page"));
const DebugAuthPage = lazy(() => import("@/components/features/auth/debug-auth-page"));
const TestInsights = lazy(() => import("@/components/features/auth/test-insights"));
const DebugMenu = lazy(() => import("@/components/features/debug/debug-menu").then(m => ({ default: m.DebugMenu })));
const ChangelogPage = lazy(() => import("@/components/features/changelog/changelog-page").then(m => ({ default: m.ChangelogPage })));
const DocsPage = lazy(() => import("@/components/features/docs/docs-page").then(m => ({ default: m.DocsPage })));
const FeedPage = lazy(() => import("@/components/features/feed/feed-page"));
const SpamFeedPage = lazy(() => import("@/components/features/feed/spam-feed-page"));
const CardLayout = lazy(() => import("@/components/social-cards/card-layout"));
const HomeSocialCardWithData = lazy(() => import("@/components/social-cards/home-card-with-data"));
const RepoCardLayout = lazy(() => import("@/components/social-cards/repo-card-layout"));
const SocialCardPreview = lazy(() => import("@/components/social-cards/preview"));
const GitHubSyncDebug = lazy(() => import("@/components/debug/github-sync-debug").then(m => ({ default: m.GitHubSyncDebug })));
const PerformanceMonitoringDashboard = lazy(() => import("@/components/performance-monitoring-dashboard").then(m => ({ default: m.PerformanceMonitoringDashboard })));
const AnalyticsDashboard = lazy(() => import("@/components/features/debug/analytics-dashboard").then(m => ({ default: m.AnalyticsDashboard })));
const ShareableChartsPreview = lazy(() => import("@/components/features/debug/shareable-charts-preview").then(m => ({ default: m.ShareableChartsPreview })));
const DubTest = lazy(() => import("@/components/features/debug/dub-test").then(m => ({ default: m.DubTest })));
const BulkAddRepos = lazy(() => import("@/components/features/debug/bulk-add-repos").then(m => ({ default: m.BulkAddRepos })));

// Settings and Privacy components
const SettingsPage = lazy(() => import("@/components/features/settings/settings-page").then(m => ({ default: m.SettingsPage })));
const PrivacyPolicyPage = lazy(() => import("@/components/features/privacy/privacy-policy-page").then(m => ({ default: m.PrivacyPolicyPage })));
const DataRequestPage = lazy(() => import("@/components/features/privacy/data-request-page").then(m => ({ default: m.DataRequestPage })));
const TermsPage = lazy(() => import("@/components/features/privacy/terms-page").then(m => ({ default: m.TermsPage })));

// Admin components
const AdminMenu = lazy(() => import("@/components/features/admin").then(m => ({ default: m.AdminMenu })));
const UserManagement = lazy(() => import("@/components/features/admin").then(m => ({ default: m.UserManagement })));
const SpamManagement = lazy(() => import("@/components/features/admin").then(m => ({ default: m.SpamManagement })));
const SpamTestTool = lazy(() => import("@/components/features/admin").then(m => ({ default: m.SpamTestTool })));
const BulkSpamAnalysis = lazy(() => import("@/components/features/admin").then(m => ({ default: m.BulkSpamAnalysis })));
const MaintainerManagement = lazy(() => import("@/components/features/admin/maintainer-management").then(m => ({ default: m.MaintainerManagement })));
const ConfidenceAnalyticsDashboard = lazy(() => import("@/components/features/admin/confidence-analytics-dashboard").then(m => ({ default: m.ConfidenceAnalyticsDashboard })));
const CaptureHealthMonitor = lazy(() => import("@/components/CaptureHealthMonitor").then(m => ({ default: m.CaptureHealthMonitor })));

// Loading fallback component
const PageSkeleton = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
  </div>
);

function App() {
  // Preload critical routes and initialize progressive features after mount
  useEffect(() => {
    const initializeDeferred = async () => {
      // Only load after a short delay to not block initial render
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Load progressive capture system (non-blocking)
      try {
        await Promise.all([
          import("@/lib/progressive-capture/manual-trigger"),
          import("@/lib/progressive-capture/smart-notifications"), 
          import("@/lib/progressive-capture/background-processor")
        ]);
      } catch (error) {
        console.warn('Progressive capture features failed to load:', error);
      }
      
      // Preload repo view (most common destination)
      import("@/components/features/repository/repo-view");
      
      // Preload login page (high probability next navigation)
      import("@/components/features/auth/login-page");
    };
    
    initializeDeferred();
  }, []);

  return (
    <ErrorBoundary context="Application Root">
      <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
        <Router>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Social card routes */}
            <Route
              path="/social-cards"
              element={
                <CardLayout>
                  <HomeSocialCardWithData />
                </CardLayout>
              }
            />
            <Route
              path="/social-cards/home"
              element={
                <CardLayout
                  title="contributor.info - Open Source Contributions"
                  description="Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact."
                  image="social-cards/home-card.png"
                  url="https://contributor.info"
                >
                  <HomeSocialCardWithData />
                </CardLayout>
              }
            />
            <Route
              path="/social-cards/:owner/:repo"
              element={<RepoCardLayout />}
            />

            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <SettingsPage />
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
              <Route
                path="/dev/social-cards"
                element={
                  <ProtectedRoute>
                    <SocialCardPreview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dev/sync-test"
                element={
                  <ProtectedRoute>
                    <GitHubSyncDebug />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dev/performance-monitoring"
                element={
                  <ProtectedRoute>
                    <PerformanceMonitoringDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dev/analytics"
                element={
                  <ProtectedRoute>
                    <AnalyticsDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dev/shareable-charts"
                element={
                  <ProtectedRoute>
                    <ShareableChartsPreview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dev/dub-test"
                element={
                  <ProtectedRoute>
                    <DubTest />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dev/bulk-add-repos"
                element={
                  <ProtectedRoute>
                    <BulkAddRepos />
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
                    <AnalyticsDashboard />
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
              
              <Route path="/:owner/:repo" element={<RepoView />}>
                <Route path="" element={<ContributionsRoute />} />
                <Route path="activity" element={<ContributionsRoute />} />
                <Route path="contributions" element={<ContributionsRoute />} />
                <Route path="health" element={<LotteryFactorRoute />} />
                <Route path="distribution" element={<DistributionRoute />} />
                <Route path="feed" element={<FeedPage />} />
                <Route path="feed/spam" element={
                  <ProtectedRoute>
                    <SpamFeedPage />
                  </ProtectedRoute>
                } />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
      <Toaster />
      <PWAInstallPrompt 
        onInstall={() => console.log('PWA installed successfully!')}
        onDismiss={() => console.log('PWA install prompt dismissed')}
      />
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;