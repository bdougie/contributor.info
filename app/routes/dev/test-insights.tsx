import { Suspense, lazy } from 'react';

const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const TestInsights = lazy(() => import('@/components/features/auth/test-insights'));

export default function TestInsightsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProtectedRoute>
        <TestInsights />
      </ProtectedRoute>
    </Suspense>
  );
}
