import { Outlet } from 'react-router';
import { Suspense, lazy } from 'react';

const RepoView = lazy(() => import('@/components/features/repository/repo-view'));

export default function RepoRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <RepoView>
        <Outlet />
      </RepoView>
    </Suspense>
  );
}
