import { Suspense, lazy } from 'react';

const WorkspaceRedirect = lazy(() =>
  import('@/components/WorkspaceRedirect').then((m) => ({ default: m.WorkspaceRedirect }))
);

export default function WorkspaceRedirectRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <WorkspaceRedirect />
    </Suspense>
  );
}
