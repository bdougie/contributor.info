import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const MaintainerManagement = lazy(() =>
  import('@/components/features/admin/maintainer-management').then((m) => ({
    default: m.MaintainerManagement,
  }))
);

export default function MaintainersRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <MaintainerManagement />
      </AdminRoute>
    </Suspense>
  );
}
