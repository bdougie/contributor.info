import { Suspense, lazy } from 'react';

const ShareableChartsPreview = lazy(() =>
  import('@/components/features/debug/shareable-charts-preview').then((m) => ({
    default: m.ShareableChartsPreview,
  }))
);

export default function ShareableChartsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ShareableChartsPreview />
    </Suspense>
  );
}
