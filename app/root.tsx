import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';

import type { Route } from './+types/root';
import { ThemeProvider } from '@/components/common/theming';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary as AppErrorBoundary } from '@/components/error-boundary';
import { PWAInstallPrompt } from '@/components/ui/pwa-install-prompt';
import { OfflineNotification } from '@/components/common/OfflineNotification';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { FeatureFlagsProvider } from '@/lib/feature-flags';
import { MetaTagsProvider, SchemaMarkup } from '@/components/common/layout';
import { queryClient } from '@/lib/query-client';
import { SVGSpriteInliner } from '@/components/ui/svg-sprite-loader';

// Import global styles
import '@/index.css';
import '@/styles/cls-fixes.css';

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* Inline critical theme script to prevent FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AppErrorBoundary context="Root">
      <QueryClientProvider client={queryClient}>
        <MetaTagsProvider>
          <SchemaMarkup />
          <ThemeProvider defaultTheme="system" storageKey="theme">
            <FeatureFlagsProvider>
              <WorkspaceProvider>
                <SVGSpriteInliner />
                <Outlet />
                <Toaster />
                <PWAInstallPrompt />
                <OfflineNotification />
              </WorkspaceProvider>
            </FeatureFlagsProvider>
          </ThemeProvider>
        </MetaTagsProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

/**
 * HydrateFallback is pre-rendered into index.html at build time for SPA mode.
 * It provides the initial loading UI while the JavaScript bundle loads.
 */
export function HydrateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading contributor.info...</p>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = 'Oops!';
  let details = 'An unexpected error occurred.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? '404' : 'Error';
    details =
      error.status === 404 ? 'The requested page could not be found.' : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold">{message}</h1>
      <p className="mt-4 text-muted-foreground">{details}</p>
      {stack && (
        <pre className="mt-4 w-full max-w-2xl overflow-x-auto rounded bg-muted p-4 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
