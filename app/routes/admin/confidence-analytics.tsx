import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const ConfidenceAnalyticsDashboard = lazy(() =>
  import('@/components/features/admin/confidence-analytics-dashboard').then((m) => ({
    default: m.ConfidenceAnalyticsDashboard,
  }))
);

export default function ConfidenceAnalyticsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <ConfidenceAnalyticsDashboard />
      </AdminRoute>
    </Suspense>
  );
}
