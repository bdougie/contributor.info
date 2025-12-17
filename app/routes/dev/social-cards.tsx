import { Suspense, lazy } from 'react';

const SocialCardPreview = lazy(() => import('@/components/social-cards/preview'));

export default function SocialCardsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <SocialCardPreview />
    </Suspense>
  );
}
