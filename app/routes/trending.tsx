import { Suspense, lazy } from 'react';
import type { Route } from './+types/trending';

const TrendingPageRoute = lazy(() =>
  import('@/pages/trending').then((m) => ({ default: m.TrendingPageRoute }))
);

/**
 * Meta function for SEO (SPA mode - no loader data available)
 */
export function meta(_args: Route.MetaArgs) {
  const title = 'Trending Repositories - Contributor.info';
  const description =
    'Discover trending repositories with significant recent activity and growth. Find the hottest GitHub projects based on stars, PRs, and contributor metrics.';

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://contributor.info/trending' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { tagName: 'link', rel: 'canonical', href: 'https://contributor.info/trending' },
  ];
}

export default function TrendingRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <TrendingPageRoute />
    </Suspense>
  );
}
