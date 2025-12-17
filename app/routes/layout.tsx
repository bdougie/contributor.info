import { Outlet } from 'react-router';
import { Suspense, lazy } from 'react';

// Lazy load the layout component
const Layout = lazy(() =>
  import('@/components/common/layout').then((m) => ({ default: m.Layout }))
);

// Minimal page skeleton for loading state
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b bg-background/95 backdrop-blur" />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded w-1/4" />
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </main>
    </div>
  );
}

export default function LayoutRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Layout>
        <Outlet />
      </Layout>
    </Suspense>
  );
}
