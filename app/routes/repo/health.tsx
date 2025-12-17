import { Suspense, lazy } from 'react';

const LotteryFactorRoute = lazy(() =>
  import('@/components/features/repository/repo-view').then((m) => ({
    default: m.LotteryFactorRoute,
  }))
);

export default function HealthPage() {
  return (
    <Suspense fallback={<div className="h-64 bg-muted animate-pulse rounded" />}>
      <LotteryFactorRoute />
    </Suspense>
  );
}
