import { Suspense, lazy } from 'react';

const WorkspaceRoutesWrapper = lazy(() =>
  import('@/components/features/workspace/WorkspaceRoutesWrapper').then((m) => ({
    default: m.WorkspaceRoutesWrapper,
  }))
);
const WorkspacePage = lazy(() =>
  import('@/pages/workspace-page').then((m) => ({
    default: m.WorkspacePage,
  }))
);

export default function WorkspaceRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <WorkspaceRoutesWrapper>
        <WorkspacePage />
      </WorkspaceRoutesWrapper>
    </Suspense>
  );
}
