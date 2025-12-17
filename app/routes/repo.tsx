import { Outlet } from 'react-router';
import { Suspense, lazy } from 'react';
import type { Route } from './+types/repo';
import { fetchRepositoryBasics } from '@/lib/supabase-server';

const RepoView = lazy(() => import('@/components/features/repository/repo-view'));

/**
 * Server-side loader for repository data
 * Fetches basic repo info for SEO and initial render
 */
export async function loader({ params }: Route.LoaderArgs) {
  const { owner, repo } = params;

  if (!owner || !repo) {
    return { repository: null };
  }

  try {
    const { repository } = await fetchRepositoryBasics(owner, repo);
    return { repository };
  } catch (error) {
    console.error('Failed to fetch repository data:', error);
    return { repository: null };
  }
}

/**
 * Meta function for SEO
 */
export function meta({ params, data }: Route.MetaArgs) {
  const { owner, repo } = params;
  const title = `${owner}/${repo} - Contributor Analysis | contributor.info`;
  const description = data?.repository?.description
    ? `${data.repository.description} - Analyze contribution patterns, PR activity, and community impact.`
    : `Analyze GitHub contributors for ${owner}/${repo}. View contribution patterns, pull request activity, and community impact metrics.`;

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
