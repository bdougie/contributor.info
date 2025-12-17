import { Suspense, lazy } from 'react';

const PrivacyPolicyPage = lazy(() =>
  import('@/components/features/privacy/privacy-policy-page').then((m) => ({
    default: m.PrivacyPolicyPage,
  }))
);

export default function PrivacyRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <PrivacyPolicyPage />
    </Suspense>
  );
}
