import { Suspense, lazy } from 'react';

const ProtectedRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.ProtectedRoute }))
);
const SettingsPage = lazy(() =>
  import('@/components/features/settings/settings-page').then((m) => ({ default: m.SettingsPage }))
);

export default function SettingsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    </Suspense>
  );
}
