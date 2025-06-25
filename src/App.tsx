import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ThemeProvider } from "@/components/common/theming";
import { Toaster } from "@/components/ui/sonner";
import { Layout, Home, NotFound } from "@/components/common/layout";
import { ProtectedRoute } from "@/components/features/auth";

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
const CardLayout = lazy(() => import("@/components/social-cards/card-layout"));
const HomeSocialCardWithData = lazy(() => import("@/components/social-cards/home-card-with-data"));
const RepoCardWithData = lazy(() => import("@/components/social-cards/repo-card-with-data"));
const SocialCardPreview = lazy(() => import("@/components/social-cards/preview"));
const GitHubSyncDebug = lazy(() => import("@/components/debug/github-sync-debug").then(m => ({ default: m.GitHubSyncDebug })));
const PerformanceMonitoringDashboard = lazy(() => import("@/components/performance-monitoring-dashboard").then(m => ({ default: m.PerformanceMonitoringDashboard })));
const AnalyticsDashboard = lazy(() => import("@/components/features/debug/analytics-dashboard").then(m => ({ default: m.AnalyticsDashboard })));
const ShareableChartsPreview = lazy(() => import("@/components/features/debug/shareable-charts-preview").then(m => ({ default: m.ShareableChartsPreview })));

// Loading fallback component
const PageSkeleton = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
  </div>
);

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
      <Router>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
                <CardLayout>
                  <HomeSocialCardWithData />
                </CardLayout>
              }
            />
            <Route
              path="/social-cards/:owner/:repo"
              element={
                <CardLayout>
                  <RepoCardWithData />
                </CardLayout>
              }
            />

            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/:owner/:repo" element={<RepoView />}>
                <Route path="" element={<ContributionsRoute />} />
                <Route path="activity" element={<ContributionsRoute />} />
                <Route path="contributions" element={<ContributionsRoute />} />
                <Route path="health" element={<LotteryFactorRoute />} />
                <Route path="distribution" element={<DistributionRoute />} />
                <Route path="feed" element={<FeedPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;