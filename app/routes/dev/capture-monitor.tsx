import { Suspense, lazy } from 'react';

const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const CaptureHealthMonitor = lazy(() =>
  import('@/components/CaptureHealthMonitor').then((m) => ({
    default: m.CaptureHealthMonitor,
  }))
);

export default function CaptureMonitorRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProtectedRoute>
        <CaptureHealthMonitor />
      </ProtectedRoute>
    </Suspense>
  );
}
