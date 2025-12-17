import { Suspense, lazy } from 'react';

const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const ManualBackfillDebug = lazy(() =>
  import('@/components/features/debug/manual-backfill-debug').then((m) => ({
    default: m.ManualBackfillDebug,
  }))
);

export default function ManualBackfillRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProtectedRoute>
        <ManualBackfillDebug />
      </ProtectedRoute>
    </Suspense>
  );
}
