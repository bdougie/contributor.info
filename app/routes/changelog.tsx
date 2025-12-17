import { Suspense, lazy } from 'react';

const ChangelogPage = lazy(() =>
  import('@/components/features/changelog/changelog-page').then((m) => ({
    default: m.ChangelogPage,
  }))
);

export default function ChangelogRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ChangelogPage />
    </Suspense>
  );
}
