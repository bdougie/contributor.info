import { Suspense, lazy } from 'react';

const NotFound = lazy(() =>
  import('@/components/common/layout').then((m) => ({ default: m.NotFound }))
);

export default function NotFoundRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <NotFound />
    </Suspense>
  );
}
