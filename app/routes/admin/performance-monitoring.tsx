import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const PerformanceMonitoringDashboard = lazy(() =>
  import('@/components/performance-monitoring-dashboard-lazy').then((m) => ({
    default: m.LazyPerformanceMonitoringDashboard,
  }))
);

export default function PerformanceMonitoringRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <PerformanceMonitoringDashboard />
      </AdminRoute>
    </Suspense>
  );
}
