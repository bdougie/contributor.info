import { Suspense, lazy } from 'react';

const TermsPage = lazy(() =>
  import('@/components/features/privacy/terms-page').then((m) => ({
    default: m.TermsPage,
  }))
);

export default function TermsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <TermsPage />
    </Suspense>
  );
}
