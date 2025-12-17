import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const UserManagement = lazy(() =>
  import('@/components/features/admin/user-management').then((m) => ({ default: m.UserManagement }))
);

export default function UsersRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <UserManagement />
      </AdminRoute>
    </Suspense>
  );
}
