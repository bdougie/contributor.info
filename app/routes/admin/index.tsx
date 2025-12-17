import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const AdminMenu = lazy(() =>
  import('@/components/features/admin/admin-menu').then((m) => ({ default: m.AdminMenu }))
);

export default function AdminIndexRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <AdminMenu />
      </AdminRoute>
    </Suspense>
  );
}
