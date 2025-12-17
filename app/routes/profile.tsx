import { Suspense, lazy } from 'react';

const ProfileRouter = lazy(() =>
  import('@/components/features/profile/profile-router').then((m) => ({ default: m.ProfileRouter }))
);

export default function ProfileRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProfileRouter />
    </Suspense>
  );
}
