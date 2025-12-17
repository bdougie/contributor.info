import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const AdminAnalyticsDashboard = lazy(() =>
  import('@/components/features/admin/admin-analytics-dashboard').then((m) => ({
    default: m.AdminAnalyticsDashboard,
  }))
);

export default function AnalyticsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <AdminAnalyticsDashboard />
      </AdminRoute>
    </Suspense>
  );
}
