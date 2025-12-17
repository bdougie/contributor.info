import { Suspense, lazy } from 'react';
import type { Route } from './+types/home';

const Home = lazy(() => import('@/components/common/layout').then((m) => ({ default: m.Home })));

/**
 * Meta function for SEO - homepage
 */
export function meta(_args: Route.MetaArgs) {
  const title = 'contributor.info - Visualizing Open Source Contributions';
  const description =
    'Discover and visualize GitHub contributors and their contributions. Track open source activity, analyze contribution patterns, and celebrate community impact.';

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://contributor.info' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { tagName: 'link', rel: 'canonical', href: 'https://contributor.info' },
  ];
}

export default function HomeRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <Home />
    </Suspense>
  );
}
