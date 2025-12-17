import { Suspense, lazy } from 'react';

const DataRequestPage = lazy(() =>
  import('@/components/features/privacy/data-request-page').then((m) => ({
    default: m.DataRequestPage,
  }))
);

export default function DataRequestRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <DataRequestPage />
    </Suspense>
  );
}
