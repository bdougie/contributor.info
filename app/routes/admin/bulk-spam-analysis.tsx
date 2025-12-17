import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const BulkSpamAnalysis = lazy(() =>
  import('@/components/features/admin/bulk-spam-analysis').then((m) => ({
    default: m.BulkSpamAnalysis,
  }))
);

export default function BulkSpamAnalysisRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <BulkSpamAnalysis />
      </AdminRoute>
    </Suspense>
  );
}
