import { Suspense, lazy } from 'react';

const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const DebugAuthPage = lazy(() => import('@/components/features/auth/debug-auth-page'));

export default function DebugAuthRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProtectedRoute>
        <DebugAuthPage />
      </ProtectedRoute>
    </Suspense>
  );
}
