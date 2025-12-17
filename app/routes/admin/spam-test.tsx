import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const SpamTestTool = lazy(() =>
  import('@/components/features/admin/spam-test-tool').then((m) => ({ default: m.SpamTestTool }))
);

export default function SpamTestRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <SpamTestTool />
      </AdminRoute>
    </Suspense>
  );
}
