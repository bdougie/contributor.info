import { Suspense, lazy } from 'react';
import type { Route } from './+types/profile';

const ProfileRouter = lazy(() =>
  import('@/components/features/profile/profile-router').then((m) => ({ default: m.ProfileRouter }))
);

/**
 * Meta function for SEO - user profile pages
 */
export function meta({ params }: Route.MetaArgs) {
  const username = params.username || 'User';
  const title = `${username}'s Profile - Contributor.info`;
  const description = `View ${username}'s open source contributions, repository activity, and impact metrics on contributor.info.`;

  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'profile' },
    { property: 'og:url', content: `https://contributor.info/${username}` },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
  ];
}

export default function ProfileRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProfileRouter />
    </Suspense>
  );
}
