import { Suspense, lazy } from 'react';

const Home = lazy(() => import('@/components/common/layout').then((m) => ({ default: m.Home })));

export default function HomeRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <Home />
    </Suspense>
  );
}
