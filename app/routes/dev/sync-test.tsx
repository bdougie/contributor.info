import { Suspense, lazy } from 'react';

const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const GitHubSyncDebug = lazy(() =>
  import('@/components/debug/github-sync-debug').then((m) => ({ default: m.GitHubSyncDebug }))
);

export default function SyncTestRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProtectedRoute>
        <GitHubSyncDebug />
      </ProtectedRoute>
    </Suspense>
  );
}
