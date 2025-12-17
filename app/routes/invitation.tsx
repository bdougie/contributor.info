import { Suspense, lazy } from 'react';

const InvitationAcceptancePage = lazy(() =>
  import('@/pages/invitation-acceptance-page').then((m) => ({
    default: m.InvitationAcceptancePage,
  }))
);

export default function InvitationRoute() {
  return (
    <Suspense fallback={<div className="h-96 bg-muted animate-pulse rounded" />}>
      <InvitationAcceptancePage />
    </Suspense>
  );
}
