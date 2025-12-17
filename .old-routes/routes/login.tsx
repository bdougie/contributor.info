import { createFileRoute } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';

const LoginPage = lazy(() => import('@/components/features/auth/login-page'));

const PageSkeleton = () => (
  <div
    className="min-h-screen bg-background flex flex-col"
    role="status"
    aria-label="Loading content"
  >
    <header className="border-b">
      <div className="flex h-16 items-center px-4 max-w-7xl mx-auto">
        <div className="text-xl font-bold">contributor.info</div>
        <div className="ml-auto h-9 w-20 bg-muted animate-pulse rounded-md" />
      </div>
    </header>
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

export const Route = createFileRoute('/login')({
  // Disable SSR for login page since it requires browser APIs and user interaction
  ssr: false,
  component: () => (
    <Suspense fallback={<PageSkeleton />}>
      <LoginPage />
    </Suspense>
  ),
});
