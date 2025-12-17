import { Suspense, lazy } from 'react';

const ContributionsRoute = lazy(() =>
  import('@/components/features/repository/repo-view').then((m) => ({
    default: m.ContributionsRoute,
  }))
);

export default function ContributionsPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded" />}>
      <ContributionsRoute />
    </Suspense>
  );
}
