import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const FailedJobsDashboard = lazy(() =>
  import('@/components/features/admin/failed-jobs-dashboard').then((m) => ({
    default: m.FailedJobsDashboard,
  }))
);

export default function FailedJobsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <FailedJobsDashboard />
      </AdminRoute>
    </Suspense>
  );
}
