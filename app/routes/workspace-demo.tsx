import { Suspense, lazy } from 'react';

const WorkspaceRoutesWrapper = lazy(() =>
  import('@/components/features/workspace/WorkspaceRoutesWrapper').then((m) => ({
    default: m.WorkspaceRoutesWrapper,
  }))
);
const DemoWorkspacePage = lazy(() =>
  import('@/pages/demo-workspace-page').then((m) => ({
    default: m.DemoWorkspacePage,
  }))
);

export default function WorkspaceDemoRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <WorkspaceRoutesWrapper>
        <DemoWorkspacePage />
      </WorkspaceRoutesWrapper>
    </Suspense>
  );
}
