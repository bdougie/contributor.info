import { Suspense, lazy } from 'react';
import type { Route } from './+types/trending';
import { fetchTrendingRepositories } from '@/lib/supabase-server';

const TrendingPageRoute = lazy(() =>
  import('@/pages/trending').then((m) => ({ default: m.TrendingPageRoute }))
);

/**
 * Server-side loader for trending repositories
 * Pre-fetches data for SEO and faster initial render
 */
export async function loader(_args: Route.LoaderArgs) {
  try {
    const { repositories } = await fetchTrendingRepositories(50);
    return { repositories, error: null };
  } catch (error) {
    console.error('Failed to fetch trending repositories:', error);
    return { repositories: [], error: 'Failed to load trending repositories' };
  }
}

/**
 * Meta function for SEO
 */
export function meta({ data }: Route.MetaArgs) {
  const repoCount = data?.repositories?.length || 0;
  const title = 'Trending Repositories - Contributor.info';
  const description = `Discover ${repoCount > 0 ? repoCount : ''} trending repositories with significant recent activity and growth. Find the hottest GitHub projects based on stars, PRs, and contributor metrics.`;

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
