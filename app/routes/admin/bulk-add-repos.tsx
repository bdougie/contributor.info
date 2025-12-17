import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const BulkAddRepos = lazy(() =>
  import('@/components/features/debug/bulk-add-repos').then((m) => ({ default: m.BulkAddRepos }))
);

export default function BulkAddReposRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <BulkAddRepos />
      </AdminRoute>
    </Suspense>
  );
}
