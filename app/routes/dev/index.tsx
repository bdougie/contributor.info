import { Suspense, lazy } from 'react';

const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const DebugMenu = lazy(() =>
  import('@/components/features/debug/debug-menu').then((m) => ({ default: m.DebugMenu }))
);

export default function DevIndexRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProtectedRoute>
        <DebugMenu />
      </ProtectedRoute>
    </Suspense>
  );
}
