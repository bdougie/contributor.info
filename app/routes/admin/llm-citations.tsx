import { Suspense, lazy } from 'react';

const AdminRoute = lazy(() =>
  import('@/components/features/auth').then((m) => ({ default: m.AdminRoute }))
);
const LLMCitationDashboard = lazy(() =>
  import('@/components/features/analytics/llm-citation-dashboard').then((m) => ({
    default: m.LLMCitationDashboard,
  }))
);

export default function LLMCitationsRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <AdminRoute>
        <LLMCitationDashboard />
      </AdminRoute>
    </Suspense>
  );
}
