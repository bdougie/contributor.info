import { Suspense, lazy } from 'react';

const BillingDashboard = lazy(() =>
  import('@/pages/billing/BillingDashboard').then((m) => ({
    default: m.BillingDashboard,
  }))
);

export default function BillingRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <BillingDashboard />
    </Suspense>
  );
}
