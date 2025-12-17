import { Outlet } from 'react-router';
import { Suspense, lazy } from 'react';
import type { Route } from './+types/repo';

const RepoView = lazy(() => import('@/components/features/repository/repo-view'));

/**
 * Meta function for SEO (SPA mode - no loader data available)
 */
export function meta({ params }: Route.MetaArgs) {
  const { owner, repo } = params;
  const title = `${owner}/${repo} - Contributor Analysis | contributor.info`;
  const description = `Analyze GitHub contributors for ${owner}/${repo}. View contribution patterns, pull request activity, and community impact metrics.`;

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'article' },
    { property: 'og:url', content: `https://contributor.info/${owner}/${repo}` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
  ];
}

export default function RepoRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <RepoView>
        <Outlet />
      </RepoView>
    </Suspense>
  );
}
