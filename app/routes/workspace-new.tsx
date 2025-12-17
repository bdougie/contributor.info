import { Suspense, lazy } from 'react';

const WorkspaceRoutesWrapper = lazy(() =>
  import('@/components/features/workspace/WorkspaceRoutesWrapper').then((m) => ({
    default: m.WorkspaceRoutesWrapper,
  }))
);
const WorkspaceNewPage = lazy(() =>
  import('@/pages/workspace-new-page').then((m) => ({
    default: m.WorkspaceNewPage,
  }))
);

export default function WorkspaceNewRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <WorkspaceRoutesWrapper>
        <WorkspaceNewPage />
      </WorkspaceRoutesWrapper>
    </Suspense>
  );
}
