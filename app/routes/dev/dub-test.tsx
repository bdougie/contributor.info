import { Suspense, lazy } from 'react';

const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const DubTest = lazy(() =>
  import('@/components/features/debug/dub-test').then((m) => ({ default: m.DubTest }))
);

export default function DubTestRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProtectedRoute>
        <DubTest />
      </ProtectedRoute>
    </Suspense>
  );
}
