import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { ThemeProvider } from '@/components/common/theming';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/error-boundary';
import { PWAInstallPrompt } from '@/components/ui/pwa-install-prompt';
import { OfflineNotification } from '@/components/common/OfflineNotification';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { FeatureFlagsProvider } from '@/lib/feature-flags';
import { SVGSpriteInliner } from '@/components/ui/svg-sprite-loader';

export const Route = createRootRoute({
  component: () => (
    <ErrorBoundary context="Application Root">
      <ThemeProvider defaultTheme="dark" storageKey="contributor-info-theme">
        <FeatureFlagsProvider>
          <SVGSpriteInliner />
          <WorkspaceProvider>
            <OfflineNotification />
            <Outlet />
            <Toaster />
            <PWAInstallPrompt />
            <TanStackRouterDevtools />
          </WorkspaceProvider>
        </FeatureFlagsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  ),
});
