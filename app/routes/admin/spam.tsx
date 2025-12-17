import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const SpamManagement = lazy(() =>
  import('@/components/features/admin/spam-management').then((m) => ({ default: m.SpamManagement }))
);

export default function SpamRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <SpamManagement />
      </AdminRoute>
    </Suspense>
  );
}
